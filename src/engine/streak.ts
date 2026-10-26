import { addDays } from './dates';

/** Days in a row with play. One freeze per week covers a single missed day automatically. */
export interface Streak {
  days: number;
  /** Freezes left this week (0 or 1). */
  freezes: number;
  lastPlayed: string | null;
  /** The week (its Sunday) the freeze count belongs to. */
  freezeWeek?: string;
  /** Recent days played and days a freeze covered (last 28 days), for the weekly calendar. */
  played?: string[];
  frozen?: string[];
}

export const FREEZES_PER_WEEK = 1;
const KEEP_DAYS = 28;

const toDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/** The Sunday that starts the week of `day` (Israeli weeks run Sunday to Saturday). */
export const weekOf = (day: string): string => addDays(day, -toDate(day).getDay());

const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);

const recent = (days: string[], today: string) => days.filter((d) => daysBetween(d, today) < KEEP_DAYS);

/**
 * Records play on `today`. Playing the next day extends the streak. Missing exactly one day is covered by the week's
 * freeze, used automatically. A longer gap simply starts a new streak at 1: nothing else is lost.
 */
export function touchStreak(s: Streak, today: string): Streak {
  const week = weekOf(today);
  const freezes = s.freezeWeek === week ? s.freezes : FREEZES_PER_WEEK;
  const played = recent(
    [...(s.played ?? []), today].filter((d, i, all) => all.indexOf(d) === i),
    today,
  );
  const frozen = recent(s.frozen ?? [], today);
  if (s.lastPlayed === today) return { ...s, freezes, freezeWeek: week, played, frozen };
  const gap = s.lastPlayed ? daysBetween(s.lastPlayed, today) : Infinity;
  if (gap === 1) return { days: s.days + 1, freezes, freezeWeek: week, lastPlayed: today, played, frozen };
  if (gap === 2 && freezes > 0) {
    const missed = addDays(today, -1);
    return {
      days: s.days + 1,
      freezes: freezes - 1,
      freezeWeek: week,
      lastPlayed: today,
      played,
      frozen: [...frozen, missed],
    };
  }
  return { days: 1, freezes, freezeWeek: week, lastPlayed: today, played, frozen };
}

/** The streak as it stands today, without playing: a gap the freeze cannot cover shows as 0, never as a loss. */
export function currentStreak(s: Streak, today: string): number {
  if (!s.lastPlayed) return 0;
  const gap = daysBetween(s.lastPlayed, today);
  const freezes = s.freezeWeek === weekOf(today) ? s.freezes : FREEZES_PER_WEEK;
  return gap <= 1 || (gap === 2 && freezes > 0) ? s.days : 0;
}

export type DayState = 'played' | 'frozen' | 'open' | 'future';

/** This week, Sunday to Saturday, for the calendar. Missed days are just "open": there is no red mark. */
export function weekCalendar(s: Streak, today: string): { day: string; state: DayState }[] {
  const start = weekOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const state: DayState = (s.played ?? []).includes(day)
      ? 'played'
      : (s.frozen ?? []).includes(day)
        ? 'frozen'
        : day > today
          ? 'future'
          : 'open';
    return { day, state };
  });
}
