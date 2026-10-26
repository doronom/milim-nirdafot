import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { GATE_HOLD_SECONDS, gateAnswer, gateQuestion } from '../../engine/parent-gate';
import { createRng } from '../../engine/rng';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import { IconButton, TopBar } from '../../ui/TopBar';
import styles from './ParentGate.module.css';
import p from './parent.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Step 1: hold a button for 3 seconds. Step 2: answer a multiplication on a keypad. */
export function ParentGate({ onOpen }: { onOpen: () => void }) {
  const navigate = useNavigate();
  const [held, setHeld] = useState(0);
  const [question, setQuestion] = useState(() => gateQuestion(createRng(Date.now())));
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const holding = useRef<{ start: number; frame: number } | null>(null);
  const passedHold = held >= 1;

  const stop = () => {
    if (holding.current) cancelAnimationFrame(holding.current.frame);
    holding.current = null;
    setHeld((h) => (h >= 1 ? 1 : 0));
  };
  const start = () => {
    if (passedHold || holding.current) return;
    const tick = () => {
      if (!holding.current) return;
      const t = Math.min(1, (performance.now() - holding.current.start) / (GATE_HOLD_SECONDS * 1000));
      setHeld(t);
      if (t >= 1) holding.current = null;
      else holding.current.frame = requestAnimationFrame(tick);
    };
    holding.current = { start: performance.now(), frame: requestAnimationFrame(tick) };
  };
  useEffect(
    () => () => {
      if (holding.current) cancelAnimationFrame(holding.current.frame);
    },
    [],
  );

  const submit = () => {
    if (Number(answer) === gateAnswer(question)) onOpen();
    else {
      setWrong(true);
      setAnswer('');
      setQuestion(gateQuestion(createRng(Date.now())));
    }
  };

  return (
    <div className={p.area}>
      <TopBar
        start={
          <IconButton label="חזרה למסע" onClick={() => navigate('/')}>
            <Icon name="forward" />
          </IconButton>
        }
        title="בקרת הורים"
      />
      <main className={p.body}>
        <div className={styles.intro}>
          <Pill tone="xp" icon="shield">
            אבטחה דו-שלבית
          </Pill>
          <h2 className={p.cardTitle}>שער בקרת הורים</h2>
          <p className={p.muted}>האזור מיועד למבוגרים: התקדמות, הגדרות ותוכן המשחק.</p>
        </div>

        <section className={p.card} aria-labelledby="gate-step-1">
          <div className={p.cardHead}>
            <span className={styles.step}>1</span>
            <h3 id="gate-step-1" className={p.toggleTitle}>
              לחיצה רצופה למשך {GATE_HOLD_SECONDS} שניות
            </h3>
            {passedHold && (
              <span className={p.ok}>
                <Icon name="check" size="sm" /> הושלם
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.hold}
            style={{ ['--local-progress' as string]: held }}
            aria-label={passedHold ? 'הלחיצה הושלמה' : `החזיקו לחוץ ${GATE_HOLD_SECONDS} שניות`}
            disabled={passedHold}
            onPointerDown={start}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && start()}
            onKeyUp={stop}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className={styles.ring}>
              <span className={styles.ringInner}>{Math.round(held * 100)}%</span>
            </span>
            <span className={p.muted}>{passedHold ? 'אפשר להמשיך לשאלה' : 'החזיקו את האצבע על העיגול'}</span>
          </button>
        </section>

        {passedHold && (
          <section className={p.card} aria-labelledby="gate-step-2">
            <div className={p.cardHead}>
              <span className={styles.step}>2</span>
              <h3 id="gate-step-2" className={p.toggleTitle}>
                שאלת חשבון
              </h3>
            </div>
            <div className={p.grid2}>
              <div className={styles.box}>
                <span className={p.caption}>תרגיל לפתרון</span>
                <span className={styles.question} dir="ltr">
                  {question.a} × {question.b} = ?
                </span>
              </div>
              <div className={`${styles.box} ${styles.answerBox}`} aria-live="polite">
                <span className={p.caption}>התשובה שלך</span>
                <span className={styles.question} aria-label="התשובה שלך">
                  {answer || ' '}
                </span>
              </div>
            </div>
            {wrong && (
              <p className={p.danger} role="alert">
                לא נכון. הנה תרגיל חדש.
              </p>
            )}
            <div className={styles.keypad} dir="ltr">
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={styles.key}
                  onClick={() => setAnswer((a) => (a.length < 3 ? a + k : a))}
                >
                  {k}
                </button>
              ))}
              <button type="button" className={styles.key} onClick={() => setAnswer('')}>
                נקה
              </button>
              <button
                type="button"
                className={styles.key}
                onClick={() => setAnswer((a) => (a.length < 3 ? `${a}0` : a))}
              >
                0
              </button>
              <button
                type="button"
                className={styles.key}
                aria-label="מחיקה"
                onClick={() => setAnswer((a) => a.slice(0, -1))}
              >
                <Icon name="backspace" />
              </button>
            </div>
            <TactileButton tone="success" block size="lg" icon="lock" onClick={submit} disabled={answer === ''}>
              אימות וכניסה לאזור ההורים
            </TactileButton>
          </section>
        )}
        <TactileButton tone="quiet" icon="compass" to="/">
          חזרה למסע של הילד
        </TactileButton>
      </main>
    </div>
  );
}
