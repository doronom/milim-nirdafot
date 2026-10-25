import type { IconName } from './icons';
import styles from './Icon.module.css';

// Designer SVGs drop into src/design/icons/ by file name; they should draw with currentColor.
const files = import.meta.glob<string>('../design/icons/*.svg', { query: '?raw', import: 'default', eager: true });
const svgByName = new Map(Object.entries(files).map(([path, svg]) => [path.replace(/^.*\/(.+)\.svg$/, '$1'), svg]));

export function Icon({
  name,
  size = 'md',
  label,
}: {
  name: IconName;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
}) {
  return (
    <span
      className={`${styles.icon} ${styles[size]}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // Trusted local files bundled at build time, not user content.
      dangerouslySetInnerHTML={{ __html: svgByName.get(name) ?? '' }}
    />
  );
}
