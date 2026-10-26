import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { WORLDS, type WorldId } from '../config/game';
import { dayKey } from '../engine/dates';
import { isWorldUnlocked, markPlayed } from '../engine/progress';
import {
  buildDuel,
  decisiveQuestions,
  DUEL_LENGTHS,
  duelStats,
  duelWinner,
  type DuelAnswer,
  type DuelLength,
  type DuelQuestion,
} from '../games/duel/duel';
import { useGameData } from '../state/content-context';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { Pill } from '../ui/Pill';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import styles from './DuelScreen.module.css';

type Phase =
  { kind: 'setup' } | { kind: 'pass'; player: 0 | 1 } | { kind: 'play'; player: 0 | 1 } | { kind: 'results' };

/** Two players, one device: same questions for both, taking turns, then a side-by-side comparison. */
export function DuelScreen() {
  const { freePlay: env } = useGameData();
  const navigate = useNavigate();
  const { progress, update } = useProgress();
  const open = WORLDS.filter((w) => isWorldUnlocked(progress, w.id)).map((w) => w.id);
  const [names, setNames] = useState<[string, string]>([progress.settings.childName ?? '', '']);
  const [length, setLength] = useState<DuelLength>(10);
  const [worlds, setWorlds] = useState<WorldId[]>(open);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [answers, setAnswers] = useState<[DuelAnswer[], DuelAnswer[]]>([[], []]);
  const questions = useMemo(() => buildDuel(env, worlds, length, seed), [env, worlds, length, seed]);
  const label = (i: 0 | 1) => names[i].trim() || (i === 0 ? 'שחקן 1' : 'שחקן 2');

  const start = () => {
    setSeed(String(Date.now()));
    setAnswers([[], []]);
    setPhase({ kind: 'pass', player: 0 });
  };
  const finishTurn = (player: 0 | 1, list: DuelAnswer[]) => {
    setAnswers((a) => (player === 0 ? [list, a[1]] : [a[0], list]));
    if (player === 0) setPhase({ kind: 'pass', player: 1 });
    else {
      update((p) => markPlayed(p, dayKey()));
      setPhase({ kind: 'results' });
    }
  };

  return (
    <div className={styles.screen}>
      <TopBar
        start={
          <IconButton label="חזרה" onClick={() => navigate('/adventure')}>
            <Icon name="back" />
          </IconButton>
        }
        title={
          <>
            <Icon name="swords" />
            דו-קרב מילים
          </>
        }
        subtitle="2 שחקנים במכשיר אחד"
      />
      <main className={styles.body}>
        {phase.kind === 'setup' && (
          <>
            <MascotBubble title="קרב ראש בראש">
              כל שחקן עונה בתורו על אותן שאלות. מי שיודע יותר מנצח; בתיקו, המהיר יותר.
            </MascotBubble>
            <div className={styles.players}>
              {([0, 1] as const).map((i) => (
                <label key={i} className={`${styles.player} ${i === 0 ? styles.p1 : styles.p2}`}>
                  <span className={styles.playerTag}>שחקן {i + 1}</span>
                  <input
                    className={styles.input}
                    value={names[i]}
                    placeholder={i === 0 ? 'שם הסייר' : 'שם היריב'}
                    maxLength={16}
                    onChange={(e) => setNames((n) => (i === 0 ? [e.target.value, n[1]] : [n[0], e.target.value]))}
                  />
                </label>
              ))}
            </div>
            <p className={styles.sectionTitle}>אורך הקרב</p>
            <div className={styles.choices} role="radiogroup" aria-label="מספר שאלות">
              {DUEL_LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={length === n}
                  className={`${styles.choice} ${length === n ? styles.on : ''}`}
                  onClick={() => setLength(n)}
                >
                  {n} שאלות
                </button>
              ))}
            </div>
            <p className={styles.sectionTitle}>עולמות התוכן</p>
            <div className={styles.worlds}>
              {open.map((id) => {
                const w = WORLDS.find((x) => x.id === id)!;
                const on = worlds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    data-world={id}
                    className={`${styles.world} ${on ? styles.on : ''}`}
                    onClick={() => setWorlds((list) => (on ? list.filter((x) => x !== id) : [...list, id].sort()))}
                  >
                    <Icon name={on ? 'check' : w.icon} />
                    {w.name}
                  </button>
                );
              })}
            </div>
            <TactileButton tone="success" block size="lg" icon="swords" onClick={start} disabled={worlds.length === 0}>
              התחל דו-קרב!
            </TactileButton>
          </>
        )}
        {phase.kind === 'pass' && (
          <div className={styles.pass}>
            <Icon name="refresh" size="xl" />
            <p className={styles.passTitle}>{phase.player === 0 ? 'מתחילים!' : 'העבירו את המכשיר'}</p>
            <p className={styles.passName}>התור של {label(phase.player)}</p>
            <TactileButton block size="lg" icon="play" onClick={() => setPhase({ kind: 'play', player: phase.player })}>
              אני מוכן/ה
            </TactileButton>
          </div>
        )}
        {phase.kind === 'play' && (
          <Turn
            key={phase.player}
            name={label(phase.player)}
            questions={questions}
            onDone={(list) => finishTurn(phase.player, list)}
          />
        )}
        {phase.kind === 'results' && (
          <Results names={[label(0), label(1)]} questions={questions} answers={answers} onRematch={start} />
        )}
      </main>
    </div>
  );
}

function Turn({
  name,
  questions,
  onDone,
}: {
  name: string;
  questions: DuelQuestion[];
  onDone: (a: DuelAnswer[]) => void;
}) {
  const { displayWord } = useGameData();
  const [index, setIndex] = useState(0);
  const [list, setList] = useState<DuelAnswer[]>([]);
  const [shownAt, setShownAt] = useState(() => performance.now());
  const [chosen, setChosen] = useState<string | null>(null);
  const q = questions[index]!;
  const choose = (o: string) => {
    if (chosen) return;
    setChosen(o);
    setList((l) => [
      ...l,
      { questionId: q.id, choice: o, correct: o === q.answer, ms: Math.round(performance.now() - shownAt) },
    ]);
  };
  const next = () => {
    if (index === questions.length - 1) onDone(list);
    else {
      setIndex(index + 1);
      setChosen(null);
      setShownAt(performance.now());
    }
  };
  return (
    <div className={styles.turn}>
      <p className={styles.turnHead}>
        <Pill tone="world">{name}</Pill>
        שאלה {index + 1} מתוך {questions.length}
      </p>
      <p className={styles.prompt}>
        {q.sentence ? (
          <>
            {q.sentence.before}
            <span className={styles.blank}>{chosen ?? ' '.repeat(6)}</span>
            {q.sentence.after}
          </>
        ) : (
          displayWord(q.prompt)
        )}
      </p>
      <div className={styles.options} role="group" aria-label="אפשרויות">
        {q.options.map((o) => (
          <button
            key={`${index}-${o}`}
            type="button"
            className={`${styles.option} ${chosen && o === q.answer ? styles.right : chosen === o ? styles.wrong : ''}`}
            onClick={() => choose(o)}
            disabled={chosen !== null}
          >
            {displayWord(o)}
          </button>
        ))}
      </div>
      {chosen && (
        <TactileButton block size="lg" icon="forward" onClick={next}>
          {index === questions.length - 1 ? 'סיום התור' : 'לשאלה הבאה'}
        </TactileButton>
      )}
    </div>
  );
}

function Results({
  names,
  questions,
  answers,
  onRematch,
}: {
  names: [string, string];
  questions: DuelQuestion[];
  answers: [DuelAnswer[], DuelAnswer[]];
  onRematch: () => void;
}) {
  const stats = [duelStats(answers[0]), duelStats(answers[1])] as const;
  const winner = duelWinner(stats[0], stats[1]);
  const decisive = decisiveQuestions(questions, answers[0], answers[1]);
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} שנ׳`;
  return (
    <div className={styles.results}>
      <span className={styles.trophy}>
        <Icon name="trophy" size="xl" />
      </span>
      <h2 className={styles.winner}>{winner === 'tie' ? 'תיקו! שניכם אלופים' : `הניצחון שייך ל${names[winner]}!`}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th />
            <th>{names[0]}</th>
            <th>{names[1]}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>תשובות נכונות</th>
            <td>
              {stats[0].correct} מתוך {stats[0].total}
            </td>
            <td>
              {stats[1].correct} מתוך {stats[1].total}
            </td>
          </tr>
          <tr>
            <th>זמן מענה ממוצע</th>
            <td>{seconds(stats[0].avgMs)}</td>
            <td>{seconds(stats[1].avgMs)}</td>
          </tr>
          <tr>
            <th>רצף מרבי</th>
            <td>{stats[0].bestStreak}</td>
            <td>{stats[1].bestStreak}</td>
          </tr>
        </tbody>
      </table>
      {decisive.length > 0 && (
        <section className={styles.decisive} aria-label="המילים שהכריעו את הקרב">
          <p className={styles.sectionTitle}>המילים שהכריעו את הקרב</p>
          {decisive.slice(0, 5).map((q) => (
            <p key={q.id} className={styles.decisiveRow}>
              {q.formula}
            </p>
          ))}
        </section>
      )}
      <TactileButton tone="success" block size="lg" icon="refresh" onClick={onRematch}>
        קרב גומלין
      </TactileButton>
      <TactileButton tone="quiet" block icon="back" to="/adventure">
        חזרה להרפתקה
      </TactileButton>
    </div>
  );
}
