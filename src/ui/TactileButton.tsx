import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';
import type { IconName } from './icons';
import styles from './TactileButton.module.css';

interface Props {
  children: ReactNode;
  icon?: IconName;
  /** World buttons follow the surrounding data-world accent. */
  /** quiet: secondary actions, on a surface instead of the accent. */
  /** danger: destructive actions (reset, delete), always behind a second step. */
  tone?: 'world' | 'success' | 'quiet' | 'danger';
  size?: 'md' | 'lg';
  block?: boolean;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

/** The pushable game button: a solid lip under the face that compresses on press. */
export function TactileButton({
  children,
  icon,
  tone = 'world',
  size = 'md',
  block,
  to,
  onClick,
  disabled,
  type = 'button',
}: Props) {
  const className = [styles.button, styles[tone], styles[size] ?? '', block ? styles.block : ''].join(' ');
  const body = (
    <>
      {icon && <Icon name={icon} size={size === 'lg' ? 'lg' : 'md'} />}
      <span>{children}</span>
    </>
  );
  if (to && !disabled) {
    return (
      <Link className={className} to={to}>
        {body}
      </Link>
    );
  }
  return (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {body}
    </button>
  );
}
