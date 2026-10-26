import type { Pos } from '../../content/types';
import type { LevelItem } from '../../games/types';

export const POS_LABEL: Record<Pos, string> = { noun: 'שם עצם', adj: 'שם תואר', verb: 'פועל', adv: 'תואר הפועל' };

/** What a Leitner item practises, in a line: "headword = synonym", a scale, an idiom... */
export function itemLine(item: LevelItem, displayWord: (w: string) => string): string {
  switch (item.kind) {
    case 'pair':
      return `${displayWord(item.entry.headword)} = ${displayWord(item.synonym)}`;
    case 'scale':
      return item.scale.weakToStrong.map(displayWord).join(' < ');
    case 'register':
      return item.register.meaning;
    case 'context':
      return item.context.options.map(displayWord).join(' / ');
    case 'idiom':
      return item.idiom.idiom;
  }
}
