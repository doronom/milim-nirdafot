import { motion as m } from 'framer-motion';
import type { ReactNode } from 'react';
import { useSfx } from '../../audio/sfx';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import styles from './Feedback.module.css';

/** Bottom drawer after an answer: verdict, the "[word] = [synonym]" line, optional extra action, and continue. */
export function Feedback({
  correct,
  title,
  formula,
  extra,
  continueLabel,
  onContinue,
}: {
  correct: boolean;
  title: string;
  formula: string;
  extra?: ReactNode;
  continueLabel: string;
  onContinue: () => void;
}) {
  useSfx(correct ? 'correct' : 'wrong');
  return (
    <m.div
      className={`${styles.drawer} ${correct ? styles.correct : styles.wrong}`}
      role="status"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={motion('feedback_burst')}
    >
      <p className={styles.title}>
        <Icon name={correct ? 'check' : 'refresh'} />
        {title}
      </p>
      <p className={styles.formula}>{formula}</p>
      {extra}
      <TactileButton tone={correct ? 'success' : 'world'} block size="lg" onClick={onContinue}>
        {continueLabel}
      </TactileButton>
    </m.div>
  );
}
