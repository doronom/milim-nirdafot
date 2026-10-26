import { addDays } from './dates';
import type { Progress } from './progress';

export const DAILY_GOALS = [10, 15, 20] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number];
export const DEFAULT_DAILY_GOAL: DailyGoal = 15;

/** Days of play time kept on the device (the dashboard shows the last week). */
export const ACTIVITY_DAYS = 60;

/** Adds play time (seconds) to a day, dropping days older than ACTIVITY_DAYS. */
export function addActivity(p: Progress, day: string, seconds: number): Progress {
  const oldest = addDays(day, -ACTIVITY_DAYS);
  const kept = Object.entries(p.activity ?? {}).filter(([d]) => d > oldest);
  const activity = Object.fromEntries(kept);
  activity[day] = (activity[day] ?? 0) + seconds;
  return { ...p, activity };
}

export const minutesOn = (p: Progress, day: string): number => Math.floor((p.activity?.[day] ?? 0) / 60);

/** Minutes played on each of the last `n` days, oldest first, ending today. */
export const recentMinutes = (p: Progress, today: string, n = 7): { day: string; minutes: number }[] =>
  Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return { day, minutes: minutesOn(p, day) };
  });

export const dailyGoal = (p: Progress): DailyGoal => p.settings.dailyGoal ?? DEFAULT_DAILY_GOAL;

/** The goal is a gentle note, never a limit: the game keeps going after it. */
export const reachedGoal = (p: Progress, today: string): boolean => minutesOn(p, today) >= dailyGoal(p);
