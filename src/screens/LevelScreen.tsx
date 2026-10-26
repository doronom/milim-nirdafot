import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { BOSS_PASS, rankForXp, WORLDS, XP } from '../config/game';
import type { Sentence } from '../content/types';
import { trapKeys } from '../engine/distractors';
import { dayKey } from '../engine/dates';
import { findLevel, type LevelDef, type StationDef, type WorldDef } from '../engine/layout';
import { applySession } from '../engine/leitner';
import {
  createPlanner,
  finishRound,
  isRunDone,
  levelOutcome,
  type LevelOutcome,
  type LevelRun,
} from '../engine/level-run';
import { worldStickers } from '../engine/album';
import {
  currentLevel,
  isLevelDone,
  isLevelUnlocked,
  markPlayed,
  recordLevel,
  recordPractice,
  unlockWorld,
} from '../engine/progress';
import { listReports, pendingKeys, reportAlsoCorrect, reportItemDispute } from '../engine/review-queue';
import { createRng } from '../engine/rng';
import { blockedSentenceIds, listSentenceReports, reportSentence } from '../engine/sentence-reports';
import type { GameData } from '../app/game-data';
import { GAME_CATALOG } from '../games/catalog';
import { GameEnvContext } from '../games/env-context';
import { pairKey } from '../games/practice';
import { createGames } from '../games/registry';
import { buildLevelSession, isPlayableLevel } from '../games/session';
import { isPair, type GameEnv, type LevelItem, type PlanContext, type RoundResult } from '../games/types';
import { useGameData } from '../state/content-context';
import { useProgress } from '../state/progress-context';
import { useStore } from '../state/store-context';
import { getRecording } from '../audio/recordings';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import { BossResults } from './level/BossResults';
import { EndOfLevel } from './level/EndOfLevel';
import { RankUp } from './level/RankUp';
import { LearnCards } from './level/LearnCards';
import { levelNumber, levelTitle } from './levelText';
import styles from './LevelScreen.module.css';

/** Review queues that change what a level may offer; loaded before the level is planned. */
interface Queues {
  pending: Set<string>;
  blocked: Set<string>;
}

export function LevelScreen() {
  const { levelId = '' } = useParams();
  const [params] = useSearchParams();
  const store = useStore();
  const { progress, loaded } = useProgress();
  const [attempt, setAttempt] = useState(0);
  // A fixed ?seed= makes every round reproducible (tests); otherwise each play differs.
  const [baseSeed] = useState(() => params.get('seed') ?? String(Date.now()));
  const [queues, setQueues] = useState<Queues | null>(null);
  const data = useGameData();
  const { content, layout, resolver } = data;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listReports(store), listSentenceReports(store)])
      .then(([pairs, sentences]) => ({
        pending: pendingKeys(pairs),
        blocked: blockedSentenceIds(sentences, content.sentences),
      }))
      .catch(() => ({ pending: new Set<string>(), blocked: new Set<string>() }))
      .then((q) => !cancelled && setQueues(q));
    return () => {
      cancelled = true;
    };
  }, [store, attempt, content]);

  const found = findLevel(layout, levelId);
  if (!loaded || !queues) return null;
  if (!found || !isLevelUnlocked(progress, found.world, levelId)) return <Navigate to="/" replace />;
  const { world, station, level } = found;
  if (!isPlayableLevel(level, resolver))
    return <ComingLater world={world} station={station} level={level} itemLabel={data.itemLabel} />;
  const seed = `${baseSeed}:${attempt}`;
  return (
    <LevelPlayer
      key={seed}
      world={world}
      station={station}
      level={level}
      seed={seed}
      queues={queues}
      data={data}
      onReplay={() => {
        setQueues(null);
        setAttempt((a) => a + 1);
      }}
    />
  );
}

function ComingLater({
  world,
  station,
  level,
  itemLabel,
}: {
  world: WorldDef;
  station?: StationDef;
  level: LevelDef;
  itemLabel: (id: string) => string | undefined;
}) {
  const navigate = useNavigate();
  const words = level.itemIds.map((id) => itemLabel(id)).filter(Boolean);
  return (
    <div data-world={world.id} className={styles.screen}>
      <TopBar
        start={
          <IconButton label="חזרה לשביל" onClick={() => navigate(`/world/${world.id}`)}>
            <Icon name="back" />
          </IconButton>
        }
        title={levelName(level, station)}
        subtitle={station?.title}
      />
      <div className={styles.body}>
        <MascotBubble>המשחקים של השלב הזה בדרך. בינתיים, אלה המילים שנלמד:</MascotBubble>
        {words.length > 0 && (
          <ul className={styles.words}>
            {words.map((w) => (
              <li key={w} className={styles.word}>
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const levelName = (level: LevelDef, station?: StationDef) => {
  const number = levelNumber(level, station);
  return number ? `שלב ${number}: ${levelTitle(level, station)}` : levelTitle(level, station);
};

/** A short label for "words to practise" on the result screen. */
function practiseLabel(item: LevelItem, displayWord: (w: string) => string): string {
  switch (item.kind) {
    case 'pair':
      return `${displayWord(item.entry.headword)} = ${displayWord(item.synonym)}`;
    case 'scale':
      return item.scale.weakToStrong.map(displayWord).join(' < ');
    case 'register':
      return item.register.meaning;
    case 'context':
      return item.context.options.map(displayWord).join(' / ');
    case 'idiom':
      return `${item.idiom.idiom} = ${item.idiom.meaning}`;
  }
}

type Phase = 'learn' | 'intro' | 'play' | 'end';

interface Finished {
  outcome: LevelOutcome;
  xp: number;
  nextId?: string;
  /** Boss levels: whether the run passed (80% or more). */
  bossPassed?: boolean;
  /** The new rank, when this level's XP crossed a threshold. */
  rankUp?: string;
  /** The level was done for the first time, so its sticker is new. */
  sticker?: boolean;
}

/** The rank reached by adding `gained` XP, if it differs from the current one. */
function rankChange(xp: number, gained: number): string | undefined {
  const after = rankForXp(xp + gained);
  return after !== rankForXp(xp) ? after : undefined;
}

function LevelPlayer({
  world,
  station,
  level,
  seed,
  queues,
  data,
  onReplay,
}: {
  world: WorldDef;
  station?: StationDef;
  level: LevelDef;
  seed: string;
  queues: Queues;
  /** Snapshot of the game data when the level started, so a content edit elsewhere does not reshape a running level. */
  data: GameData;
  onReplay: () => void;
}) {
  const { content, displayWord, graph, links, layout } = data;
  const navigate = useNavigate();
  const store = useStore();
  const { progress, update } = useProgress();
  const { reviewedOnly, reviewedSentencesOnly = false } = progress.settings;
  const [pending, setPending] = useState(queues.pending);
  const [blocked, setBlocked] = useState(queues.blocked);
  const ctx: PlanContext = useMemo(
    () => ({ content, sentences: { reviewedOnly: reviewedSentencesOnly, blocked } }),
    [content, reviewedSentencesOnly, blocked],
  );
  // Snapshot the Leitner state and queues at the start, so the plan does not shift while it is played.
  const [session] = useState(() =>
    buildLevelSession(level, progress.leitner, seed, {
      resolver: data.resolver,
      guestResolver: data.guestResolver(reviewedOnly),
      ctx,
      reviewFallback: world.stations.flatMap((s) => s.levels.flatMap((l) => l.itemIds)),
    }),
  );
  const [planner] = useState(() => createPlanner(world.id, GAME_CATALOG, ctx));
  const [phase, setPhase] = useState<Phase>(session.learn.length > 0 ? 'learn' : 'intro');
  const [known, setKnown] = useState<string[]>([]);
  const [run, setRun] = useState(session.run);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [round, setRound] = useState<unknown>(null);
  const [rankSeen, setRankSeen] = useState(false);
  const [recordings, setRecordings] = useState<Record<string, Blob>>({});

  // The parent's recordings of custom words, for the learn cards.
  useEffect(() => {
    let cancelled = false;
    const ids = session.learn.flatMap((i) => (isPair(i) && i.entry.source === 'custom' ? [i.entry.id] : []));
    void Promise.all(ids.map(async (id) => [id, await getRecording(store, id)] as const)).then((found) => {
      if (!cancelled) setRecordings(Object.fromEntries(found.filter((f): f is [string, Blob] => f[1] !== undefined)));
    });
    return () => {
      cancelled = true;
    };
  }, [session, store]);

  const env: GameEnv = useMemo(
    () => ({
      ...ctx,
      graph,
      links,
      pool: data.entryPool(reviewedOnly, world.id),
      decisions: { confirmedTraps: trapKeys(content.notSynonyms), pending },
      displayWord,
    }),
    [ctx, data, content, graph, links, displayWord, reviewedOnly, pending, world.id],
  );
  const games = useMemo(() => createGames(env), [env]);
  const plan = run.rounds[run.index];

  // Each round is built once, when it starts, from the adapted difficulty and any re-inserted items.
  const startRound = (r: LevelRun) => {
    const p = r.rounds[r.index]!;
    setRound(games.get(p.gameId)!.buildRound(p.items, p.difficulty, createRng(`${seed}:round:${r.index}`), p.stage));
    setPhase('play');
  };

  const finish = (done: LevelRun) => {
    const outcome = levelOutcome(done);
    const xp = outcome.correctAnswers * XP.perCorrectAnswer + outcome.stars * XP.perStar;
    const today = dayKey();
    const record = {
      levelId: level.id,
      stars: outcome.stars,
      accuracy: outcome.accuracy,
      xp,
      leitner: applySession(progress.leitner, outcome.perItem, known, today),
      completedAt: new Date().toISOString(),
    };
    const firstTime = !isLevelDone(progress, level.id);
    if (level.kind === 'boss') {
      // A pass marks the boss done and opens the next world; "not yet" keeps the practice and takes nothing away.
      const passed = outcome.accuracy >= BOSS_PASS;
      const gained = passed ? xp + XP.bossPass : xp;
      update((p) => {
        const leitner = applySession(p.leitner, outcome.perItem, known, today);
        const after = passed
          ? unlockWorld(recordLevel(p, { ...record, xp: gained, leitner }), world.id + 1)
          : recordPractice(p, { xp, leitner });
        return markPlayed(after, today);
      });
      setFinished({
        outcome,
        xp: gained,
        bossPassed: passed,
        rankUp: rankChange(progress.xp, gained),
        sticker: passed && firstTime,
      });
      setPhase('end');
      return;
    }
    // Custom words run their own short path; everything else follows the world's order.
    const next =
      station?.kind === 'custom' ? station.levels[level.index] : currentLevel(recordLevel(progress, record), world);
    update((p) =>
      markPlayed(recordLevel(p, { ...record, leitner: applySession(p.leitner, outcome.perItem, known, today) }), today),
    );
    setFinished({ outcome, xp, nextId: next?.id, rankUp: rankChange(progress.xp, xp), sticker: firstTime });
    setPhase('end');
  };

  const onRoundDone = (result: RoundResult) => {
    const nextRun = finishRound(run, result, planner);
    setRun(nextRun);
    if (isRunDone(nextRun)) finish(nextRun);
    else startRound(nextRun);
  };

  const gameId = plan?.gameId ?? 'unknown';
  const onAlsoCorrect = (item: LevelItem, word: string, nodeId?: string) => {
    if (isPair(item)) {
      setPending((p) => new Set(p).add(pairKey(item.entry, word)));
      void reportAlsoCorrect(store, { target: item.entry, word, nodeId: nodeId ?? word, gameId });
    } else {
      void reportItemDispute(store, { itemKey: item.key, answer: word, gameId });
    }
  };
  const onReportSentence = (sentence: Sentence) => {
    // Out of play right away (unless already approved), and queued for the parent.
    if (!sentence.reviewed) setBlocked((b) => new Set(b).add(sentence.id));
    void reportSentence(store, sentence, gameId);
  };

  const name = levelName(level, station);
  const isBoss = level.kind === 'boss';
  const bossNeeded = Math.ceil(session.items.length * BOSS_PASS);
  const bossCorrect = run.answers.filter((a) => a.outcome !== 'wrong').length;
  const subtitle =
    phase === 'learn'
      ? 'כרטיסי לימוד'
      : phase === 'play'
        ? isBoss
          ? `נכונות עד כה: ${bossCorrect} מתוך ${session.items.length} · יעד ${bossNeeded}`
          : `סבב ${run.index + 1} מתוך ${run.rounds.length}`
        : station?.title;
  const game = plan ? games.get(plan.gameId) : undefined;
  const nextLevel = finished?.nextId ? findLevel(layout, finished.nextId) : null;
  const counted = session.learn.length > 0 ? session.learn : session.items;
  const practise = (finished?.outcome.missed ?? [])
    .map((key) => session.items.find((i) => i.key === key))
    .filter((i): i is LevelItem => Boolean(i))
    .map((i) => practiseLabel(i, displayWord));

  return (
    <GameEnvContext.Provider value={env}>
      <div data-world={world.id} className={styles.screen}>
        <TopBar
          start={
            <IconButton label="יציאה מהשלב" onClick={() => navigate(`/world/${world.id}`)}>
              <Icon name="back" />
            </IconButton>
          }
          title={name}
          subtitle={subtitle}
        />
        <main className={styles.body}>
          {phase === 'learn' && (
            <LearnCards
              items={session.learn}
              sentenceFor={(e) => data.sentenceFor(e, reviewedOnly)}
              displayWord={displayWord}
              recordingFor={(e) => recordings[e.id]}
              onDone={(k) => {
                setKnown(k);
                startRound(run);
              }}
            />
          )}
          {phase === 'intro' && (
            <>
              <MascotBubble>
                {isBoss
                  ? `שומר ${WORLDS.find((w) => w.id === world.id)!.name} מחכה: ${session.items.length} שאלות מכל העולם. ${bossNeeded} תשובות נכונות פותחות את הדרך הלאה.`
                  : session.items.length > 0
                    ? `סבב חזרה: ${session.items.length} פריטים מהמסע שלכם, החלשים ביותר קודם.`
                    : 'אין עדיין מה לחזור עליו. שחקו עוד שלבים וחזרו לכאן.'}
              </MascotBubble>
              {session.items.length > 0 && plan && (
                <TactileButton block size="lg" icon={isBoss ? 'swords' : 'play'} onClick={() => startRound(run)}>
                  {isBoss ? 'לקרב!' : 'מתחילים'}
                </TactileButton>
              )}
            </>
          )}
          {phase === 'play' && game && plan && round !== null && (
            <game.Component
              key={run.index}
              round={round as never}
              difficulty={plan.difficulty}
              stage={plan.stage}
              onDone={onRoundDone}
              onAlsoCorrect={onAlsoCorrect}
              onReportSentence={onReportSentence}
            />
          )}
          {phase === 'end' && finished && isBoss && (
            <BossResults
              passed={finished.bossPassed ?? false}
              correct={finished.outcome.correctAnswers}
              total={run.answers.length}
              needed={bossNeeded}
              unlocked={
                world.id < 4 ? { id: world.id + 1, name: WORLDS.find((w) => w.id === world.id + 1)!.name } : undefined
              }
              practise={practise}
              pathTo={`/world/${world.id}`}
              certificateTo={`/certificate/${world.id}`}
              onRetry={onReplay}
            />
          )}
          {phase === 'end' && finished && !isBoss && (
            <EndOfLevel
              levelName={name}
              stars={finished.outcome.stars}
              accuracy={finished.outcome.accuracy}
              xp={finished.xp}
              wordsLearned={counted.filter((i) => !finished.outcome.missed.includes(i.key)).length}
              wordsTotal={counted.length}
              practise={practise}
              nextTo={nextLevel ? `/level/${nextLevel.level.id}` : undefined}
              nextLabel={nextLevel ? `לשלב הבא (${levelName(nextLevel.level, nextLevel.station)})` : undefined}
              pathTo={`/world/${world.id}`}
              onReplay={onReplay}
              sticker={finished.sticker ? stickerOf(data, world, level) : undefined}
            />
          )}
          {phase === 'end' && finished?.rankUp && !rankSeen && (
            <RankUp rank={finished.rankUp} onClose={() => setRankSeen(true)} />
          )}
        </main>
      </div>
    </GameEnvContext.Provider>
  );
}

/** The sticker a level awards (its slot in the album). */
function stickerOf(data: GameData, world: WorldDef, level: LevelDef) {
  return worldStickers(data.layout, world.id, data.stickerLabel).find((s) => s.levelId === level.id);
}
