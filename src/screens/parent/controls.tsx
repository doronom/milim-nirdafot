import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../../ui/Icon';
import styles from './parent.module.css';

/** A labelled on/off switch row. */
export function Toggle({
  title,
  description,
  on,
  onChange,
}: {
  title: string;
  description?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} className={styles.toggleRow} onClick={() => onChange(!on)}>
      <span className={styles.toggleText}>
        <span className={styles.toggleTitle}>{title}</span>
        {description && <span className={styles.muted}>{description}</span>}
      </span>
      <span className={`${styles.switch} ${on ? styles.switchOn : ''}`} aria-hidden>
        <span className={styles.knob} />
      </span>
    </button>
  );
}

/** One choice out of a few, as large buttons. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; title: ReactNode; note?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`${styles.segment} ${o.value === value ? styles.segmentOn : ''}`}
          onClick={() => onChange(o.value)}
        >
          <span className={styles.toggleTitle}>{o.title}</span>
          {o.note && <span className={styles.caption}>{o.note}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {note && <span className={styles.caption}>{note}</span>}
    </label>
  );
}

/** Why a save was blocked, in the parent's words. */
export function Problems({ problems }: { problems: readonly string[] }) {
  if (problems.length === 0) return null;
  return (
    <div className={styles.error} role="alert">
      <strong>אי אפשר לשמור:</strong>
      <ul>
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A passcode input on the system keyboard (any letters, digits, symbols), with autocomplete, autocorrect and
 * capitalization off, and a show/hide toggle.
 */
export function PasscodeField({
  label,
  value,
  onChange,
  disabled,
  autoFocus,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.passcodeRow}>
        <input
          id={id}
          className={styles.input}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          dir="auto"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className={styles.linkButton}
          aria-label={shown ? 'הסתרת הקוד' : 'הצגת הקוד'}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size="sm" />
        </button>
      </div>
    </div>
  );
}
