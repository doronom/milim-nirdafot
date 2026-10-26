import styles from './BarChart.module.css';
import p from './parent.module.css';

export interface Bar {
  key: string;
  /** Short label under the bar. */
  label: string;
  /** Full label for the tooltip and screen readers. */
  title: string;
  value: number;
  /** Marks today, for example. */
  highlight?: boolean;
}

/**
 * A single-series bar chart in HTML: magnitude in one hue, values labelled on the bars, an optional reference line
 * (the daily goal), a tooltip on hover or focus, and the same numbers as a table for screen readers.
 */
export function BarChart({
  label,
  bars,
  unit,
  reference,
}: {
  label: string;
  bars: readonly Bar[];
  unit: string;
  reference?: { value: number; label: string };
}) {
  const max = Math.max(1, ...bars.map((b) => b.value), reference?.value ?? 0);
  return (
    <figure className={styles.figure}>
      <div className={styles.plot} aria-hidden>
        {reference && <div className={styles.reference} style={{ ['--local-at' as string]: reference.value / max }} />}
        {bars.map((b) => (
          <div key={b.key} className={styles.column}>
            <span className={styles.value}>{b.value}</span>
            <span
              className={`${styles.bar} ${b.highlight ? styles.highlight : ''} ${b.value === 0 ? styles.empty : ''}`}
              style={{ ['--local-h' as string]: b.value / max }}
            />
            <span className={styles.tooltip}>
              {b.title}: {b.value} {unit}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.axis} aria-hidden>
        {bars.map((b) => (
          <span key={b.key} className={b.highlight ? styles.axisToday : undefined}>
            {b.label}
          </span>
        ))}
      </div>
      {reference && (
        <p className={styles.legend} aria-hidden>
          <span className={styles.legendLine} /> {reference.label}
        </p>
      )}
      <table className={p.visuallyHidden}>
        <caption>{label}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.title}</th>
              <td>
                {b.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
