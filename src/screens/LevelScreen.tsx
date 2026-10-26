import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { XP } from '../config/game';
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
import { currentLevel, isLevelUnlocked, recordLevel } from '../engine/progress';
import { listReports, pendingKeys, reportAlsoCorrect, reportItemDispute } from '../engine/review-queue';
import { createRng } from '../engine/rng';
import { blockedSentenceIds, listSentenceReports, reportSentence } from '../engine/sentence-reports';
import { content, displayWord, entryPool, graph, guestPool, itemLabel, layout, links, sentenceFor } from '../app/data';
import { GAME_CATALOG } from '../games/catalog';
import { GameEnvContext } from '../games/env-context';
import { createResolver } from '../games/items';
import { pairKey } from '../games/practice';
import { createGames } from '../games/registry';
import { buildLevelSession, isPlayableLevel } from '../games/session';
import { isPair, type GameEnv, type LevelItem, type PlanContext, type RoundResult } from '../games/types';
import { useProgress } from '../state/progress-context';
import { useStore } from '../state/store-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import { EndOfLevel } from './level/EndOfLevel';
import { LearnCards } from './level/LearnCards';
import { levelNumber, levelTitle } from './levelText';
import styles from './LevelScreen.module.css';

const levelResolver = createResolver(content);

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
  }, [store, attempt]);

  const found = findLevel(layout, levelId);
  if (!loaded || !queues) return null;
  if (!found || !isLevelUnlocked(progress, found.world, levelId)) return <Navigate to="/" replace />;
  const { world, station, level } = found;
  if (!isPlayableLevel(level, levelResolver)) return <ComingLater world={world} station={station} level={level} />;
  const seed = `${baseSeed}:${attempt}`;
  return (
    <LevelPlayer
      key={seed}
      world={world}
      station={station}
      level={level}
      seed={seed}
      queues={queues}
      onReplay={() => {
        setQueues(null);
        setAttempt((a) => a + 1);
      }}
    />
  );
}

function ComingLater({ world, station, level }: { world: WorldDef; station?: StationDef; level: LevelDef }) {
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
function practiseLabel(item: LevelItem): string {
  switch (item.kind) {
    case 'pair':
      return `${displayWord(item.entry.headword)} = ${displayWord(item.synonym)}`;
    case 'scale':
      return item.scale.weakToStrong.map(displayWord).join(' < ');
    case 'register':
      return item.register.meaning;
    case 'context':
      return item.context.options.map(displayWord).join(' / ');
  }
}

type Phase = 'learn' | 'intro' | 'play' | 'end';

interface Finished {
  outcome: LevelOutcome;
  xp: number;
  nextId?: string;
}

function LevelPlayer({
  world,
  station,
  level,
  seed,
  queues,
  onReplay,
}: {
  world: WorldDef;
  station?: StationDef;
  level: LevelDef;
  seed: string;
  queues: Queues;
  onReplay: () => void;
}) {
  const navigate = useNavigate();
  const store = useStore();
  const { progress, update } = useProgress();
  const { reviewedOnly, reviewedSentencesOnly = false } = progress.settings;
  const [pending, setPending] = useState(queues.pending);
  const [blocked, setBlocked] = useState(queues.blocked);
  const ctx: PlanContext = useMemo(
    () => ({ content, sentences: { reviewedOnly: reviewedSentencesOnly, blocked } }),
    [reviewedSentencesOnly, blocked],
  );
  // Snapshot the Leitner state and queues at the start, so the plan does not shift while it is played.
  const [session] = useState(() =>
    buildLevelSession(level, progress.leitner, seed, {
      resolver: levelResolver,
      guestResolver: createResolver(content, guestPool(reviewedOnly)),
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

  const env: GameEnv = useMemo(
    () => ({
      ...ctx,
      graph,
      links,
      pool: entryPool(reviewedOnly, world.id),
      decisions: { confirmedTraps: trapKeys(content.notSynonyms), pending },
      displayWord,
    }),
    [ctx, reviewedOnly, pending, world.id],
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
    const next = currentLevel(recordLevel(progress, record), world);
    update((p) => recordLevel(p, { ...record, leitner: applySession(p.leitner, outcome.perItem, known, today) }));
    setFinished({ outcome, xp, nextId: next?.id });
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
  const subtitle =
    phase === 'learn'
      ? 'כרטיסי לימוד'
      : phase === 'play'
        ? `סבב ${run.index + 1} מתוך ${run.rounds.length}`
        : station?.title;
  const game = plan ? games.get(plan.gameId) : undefined;
  const nextLevel = finished?.nextId ? findLevel(layout, finished.nextId) : null;
  const counted = session.learn.length > 0 ? session.learn : session.items;
  const practise = (finished?.outcome.missed ?? [])
    .map((key) => session.items.find((i) => i.key === key))
    .filter((i): i is LevelItem => Boolean(i))
    .map(practiseLabel);

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
              sentenceFor={(e) => sentenceFor(e, reviewedOnly)}
              displayWord={displayWord}
              onDone={(k) => {
                setKnown(k);
                startRound(run);
              }}
            />
          )}
          {phase === 'intro' && (
            <>
              <MascotBubble>
                {session.items.length > 0
                  ? `סבב חזרה: ${session.items.length} פריטים מהמסע שלכם, החלשים ביותר קודם.`
                  : 'אין עדיין מה לחזור עליו. שחקו עוד שלבים וחזרו לכאן.'}
              </MascotBubble>
              {session.items.length > 0 && plan && (
                <TactileButton block size="lg" icon="play" onClick={() => startRound(run)}>
                  מתחילים
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
          {phase === 'end' && finished && (
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
            />
          )}
        </main>
      </div>
    </GameEnvContext.Provider>
  );
}
