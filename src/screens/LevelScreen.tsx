import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { XP } from '../config/game';
import { trapKeys } from '../engine/distractors';
import { dayKey } from '../engine/dates';
import { findLevel, type LevelDef, type StationDef, type WorldDef } from '../engine/layout';
import { applySession } from '../engine/leitner';
import { finishRound, isRunDone, levelOutcome, type LevelOutcome, type LevelRun } from '../engine/level-run';
import { currentLevel, isLevelUnlocked, recordLevel } from '../engine/progress';
import { reportAlsoCorrect, listReports, pendingKeys } from '../engine/review-queue';
import { createRng } from '../engine/rng';
import { content, displayWord, entryPool, graph, itemLabel, layout, links, sentenceFor } from '../app/data';
import { GameEnvContext } from '../games/env-context';
import { pairKey } from '../games/practice';
import { createGames, REVIEW_GAME } from '../games/registry';
import { buildLevelSession, isEntryLevel } from '../games/session';
import type { GameEnv, PracticeItem, RoundResult } from '../games/types';
import { useProgress } from '../state/progress-context';
import { useStore } from '../state/store-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { IconButton, TopBar } from '../ui/TopBar';
import { EndOfLevel } from './level/EndOfLevel';
import { LearnCards } from './level/LearnCards';
import { levelNumber, levelTitle } from './levelText';
import styles from './LevelScreen.module.css';

export function LevelScreen() {
  const { levelId = '' } = useParams();
  const [params] = useSearchParams();
  const { progress, loaded } = useProgress();
  const [attempt, setAttempt] = useState(0);
  // A fixed ?seed= makes every round reproducible (tests); otherwise each play differs.
  const [baseSeed] = useState(() => params.get('seed') ?? String(Date.now()));
  const found = findLevel(layout, levelId);
  if (!loaded) return null;
  if (!found || !isLevelUnlocked(progress, found.world, levelId)) return <Navigate to="/" replace />;
  const { world, station, level } = found;
  const seed = `${baseSeed}:${attempt}`;
  if (!isEntryLevel(level, content)) return <ComingLater world={world} station={station} level={level} />;
  return (
    <LevelPlayer
      key={seed}
      world={world}
      station={station}
      level={level}
      seed={seed}
      onReplay={() => setAttempt((a) => a + 1)}
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

type Phase = 'learn' | 'play' | 'end';

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
  onReplay,
}: {
  world: WorldDef;
  station?: StationDef;
  level: LevelDef;
  seed: string;
  onReplay: () => void;
}) {
  const navigate = useNavigate();
  const store = useStore();
  const { progress, update } = useProgress();
  // Snapshot the Leitner state at the start, so the session does not shift while it is played.
  const [session] = useState(() => buildLevelSession(level, content, progress.leitner, seed));
  const [phase, setPhase] = useState<Phase>('learn');
  const [known, setKnown] = useState<string[]>([]);
  const [run, setRun] = useState(session.run);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState<Finished | null>(null);
  const [round, setRound] = useState<unknown>(null);
  const reviewedOnly = progress.settings.reviewedOnly;

  useEffect(() => {
    listReports(store)
      .then((r) => setPending(pendingKeys(r)))
      .catch(() => undefined);
  }, [store]);

  const env: GameEnv = useMemo(
    () => ({
      content,
      graph,
      links,
      pool: entryPool(reviewedOnly, world.id),
      decisions: { confirmedTraps: trapKeys(content.notSynonyms), pending },
      displayWord,
    }),
    [reviewedOnly, pending, world.id],
  );
  const games = useMemo(() => createGames(env), [env]);

  const plan = run.rounds[run.index];
  // Each round is built once, when it starts, from the adapted difficulty and any re-inserted items.
  const startRound = (r: LevelRun) => {
    const p = r.rounds[r.index]!;
    setRound(games.get(p.gameId)!.buildRound(p.items, p.difficulty, createRng(`${seed}:round:${r.index}`)));
  };

  const finish = (done: typeof run) => {
    const outcome = levelOutcome(done);
    const xp = outcome.correctAnswers * XP.perCorrectAnswer + outcome.stars * XP.perStar;
    const today = dayKey();
    const knownKeys = session.items.filter((i) => known.includes(i.entry.id)).map((i) => i.key);
    const record = {
      levelId: level.id,
      stars: outcome.stars,
      accuracy: outcome.accuracy,
      xp,
      leitner: applySession(progress.leitner, outcome.perItem, knownKeys, today),
      completedAt: new Date().toISOString(),
    };
    const next = currentLevel(recordLevel(progress, record), world);
    update((p) => recordLevel(p, { ...record, leitner: applySession(p.leitner, outcome.perItem, knownKeys, today) }));
    setFinished({ outcome, xp, nextId: next?.id });
    setPhase('end');
  };

  const onRoundDone = (result: RoundResult) => {
    const nextRun = finishRound(run, result, REVIEW_GAME);
    setRun(nextRun);
    if (isRunDone(nextRun)) finish(nextRun);
    else startRound(nextRun);
  };

  const onAlsoCorrect = (item: PracticeItem, word: string, nodeId: string) => {
    setPending((p) => new Set(p).add(pairKey(item.entry, word)));
    void reportAlsoCorrect(store, { target: item.entry, word, nodeId, gameId: plan?.gameId ?? 'unknown' });
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
  const practise = (finished?.outcome.missed ?? [])
    .map((key) => session.items.find((i) => i.key === key))
    .filter((i): i is PracticeItem => Boolean(i))
    .map((i) => `${displayWord(i.entry.headword)} = ${displayWord(i.synonym)}`);

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
              entries={session.entries}
              sentenceFor={(e) => sentenceFor(e, reviewedOnly)}
              displayWord={displayWord}
              onDone={(k) => {
                setKnown(k);
                startRound(run);
                setPhase('play');
              }}
            />
          )}
          {phase === 'play' && game && plan && round !== null && (
            <game.Component
              key={run.index}
              round={round as never}
              difficulty={plan.difficulty}
              onDone={onRoundDone}
              onAlsoCorrect={onAlsoCorrect}
            />
          )}
          {phase === 'end' && finished && (
            <EndOfLevel
              levelName={name}
              stars={finished.outcome.stars}
              accuracy={finished.outcome.accuracy}
              xp={finished.xp}
              wordsLearned={session.items.length - finished.outcome.missed.length}
              wordsTotal={session.items.length}
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
