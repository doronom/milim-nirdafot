import type { Sticker as StickerDef } from '../engine/album';
import { Icon } from './Icon';
import styles from './Sticker.module.css';

/** A collectible sticker: world colour, an icon and its word. A silhouette when not placed yet. */
export function Sticker({ sticker, silhouette = false }: { sticker: StickerDef; silhouette?: boolean }) {
  return (
    <span
      data-world={sticker.worldId}
      className={`${styles.sticker} ${sticker.golden ? styles.golden : ''} ${silhouette ? styles.silhouette : ''}`}
    >
      <span className={styles.badge}>
        <Icon name={sticker.icon} size="xl" />
      </span>
      <span className={styles.name}>{sticker.name}</span>
    </span>
  );
}
