/** Game-wide configuration: worlds, the games each world unlocks, ranks and level sizing. */

export type WorldId = 1 | 2 | 3 | 4;

export type GameId =
  | 'pickSynonym'
  | 'dragPairs'
  | 'memory'
  | 'oddOneOut'
  | 'swapWord'
  | 'wordSearch'
  | 'intensityLadder'
  | 'registerSort'
  | 'contextChoice'
  | 'idiomMatch'
  | 'crossword'
  | 'typeSynonym'
  | 'speedChallenge';

export interface WorldConfig {
  id: WorldId;
  name: string;
  tagline: string;
  icon: 'anchor' | 'trees' | 'mountain' | 'tower';
  /** Games first unlocked in this world; later worlds keep earlier games. */
  newGames: GameId[];
}

export const WORLDS: readonly WorldConfig[] = [
  {
    id: 1,
    name: 'נמל היסודות',
    tagline: 'כאן מתחיל המסע: המילים הנרדפות הראשונות שלך.',
    icon: 'anchor',
    newGames: ['pickSynonym', 'dragPairs', 'memory'],
  },
  {
    id: 2,
    name: 'יער ההרחבה',
    tagline: 'שבילים חדשים ומילים עשירות יותר.',
    icon: 'trees',
    newGames: ['oddOneOut', 'swapWord', 'wordSearch'],
  },
  {
    id: 3,
    name: 'הרי הדיוק',
    tagline: 'חזק, חזק יותר, הכי חזק: בוחרים את המילה המדויקת.',
    icon: 'mountain',
    newGames: ['intensityLadder', 'registerSort', 'contextChoice'],
  },
  {
    id: 4,
    name: 'מגדל המומחים',
    tagline: 'ניבים, תשבצים ואתגרי מהירות למומחים.',
    icon: 'tower',
    newGames: ['idiomMatch', 'crossword', 'typeSynonym', 'speedChallenge'],
  },
];

export const gamesForWorld = (world: WorldId): GameId[] =>
  WORLDS.filter((w) => w.id <= world).flatMap((w) => w.newGames);

/** Ranks by XP threshold, lowest first. */
export const RANKS: readonly { name: string; minXp: number }[] = [
  { name: 'טירון', minXp: 0 },
  { name: 'חוקר', minXp: 300 },
  { name: 'מגלה', minXp: 1000 },
  { name: 'מומחה', minXp: 2500 },
  { name: 'אלוף המילים', minXp: 5000 },
];

export const rankForXp = (xp: number): string => [...RANKS].reverse().find((r) => xp >= r.minXp)!.name;

/** New items per level. A station whose count cannot split into this range gets the closest fit. */
export const LEVEL_SIZE = { min: 6, max: 8 } as const;

export const BOSS_SIZE = 15;
export const BOSS_PASS = 0.8;

/** Short station names for the path screen; the booklet's full category titles stay in the data. */
export const STATION_TITLES: Record<string, string> = {
  emotions: 'רגשות ותחושות',
  'size-shape': 'גודל וצורה',
  character: 'אופי ותכונות',
  description: 'מילים לתיאור',
  'verbs-motion': 'תנועה וגוף',
  'verbs-speech': 'דיבור והבעה',
  'verbs-mind': 'חשיבה וחושים',
  'verbs-action': 'עשייה ופעולה',
  'people-places': 'אנשים ומקומות',
  'things-nature-ideas': 'חפצים, טבע ורעיונות',
  'time-quantity': 'זמן וכמות',
};

/** XP for a finished level, until the motivation milestone tunes it. */
export const XP = { perCorrectAnswer: 5, perStar: 10 } as const;
