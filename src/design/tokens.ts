import designer from './tokens.json';
import supplement from './tokens.supplement.json';

/**
 * Design tokens. tokens.json is the designer's file, dropped in verbatim; tokens.supplement.json fills gaps.
 * Every token becomes a CSS custom property named from its path: colors.base.bg_dark -> --wq-colors-base-bg-dark.
 * World colors also get order-based aliases (--wq-world-1-primary ...) so renaming a world key is not breaking.
 */
type TokenTree = { [key: string]: string | number | TokenTree };

/** Top-level keys that describe the file rather than style anything. */
const META_KEYS = new Set(['theme', 'version', 'direction', 'device', '_note']);

const isTree = (v: unknown): v is TokenTree => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep merge where `over` wins. */
export function mergeTokens(base: TokenTree, over: TokenTree): TokenTree {
  const out: TokenTree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const prev = out[k];
    out[k] = isTree(prev) && isTree(v) ? mergeTokens(prev, v) : v;
  }
  return out;
}

const segment = (s: string) => s.replace(/_/g, '-').toLowerCase();

export function flattenTokens(tree: TokenTree): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: TokenTree, path: string[]) => {
    for (const [k, v] of Object.entries(node)) {
      if (path.length === 0 && META_KEYS.has(k)) continue;
      const next = [...path, segment(k)];
      if (isTree(v)) walk(v, next);
      else out[`--wq-${next.join('-')}`] = String(v);
    }
  };
  walk(tree, []);
  const worlds = (tree.colors as TokenTree | undefined)?.worlds;
  if (isTree(worlds)) {
    Object.values(worlds).forEach((world, i) => {
      if (!isTree(world)) return;
      for (const [k, v] of Object.entries(world)) {
        if (!isTree(v)) out[`--wq-world-${i + 1}-${segment(k)}`] = String(v);
      }
    });
  }
  return out;
}

export const tokens = mergeTokens(supplement as TokenTree, designer as unknown as TokenTree);
export const cssVariables = flattenTokens(tokens);

export const tokensToCss = (vars: Record<string, string>): string =>
  `:root {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}\n`;

/** Injects the token variables once, before the first render. */
export function applyTokens(doc: Document = document): void {
  const id = 'wq-tokens';
  let style = doc.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = id;
    doc.head.prepend(style);
  }
  style.textContent = tokensToCss(cssVariables);
}

export interface MotionSpec {
  /** Seconds, as Framer Motion expects. */
  duration: number;
  ease: [number, number, number, number] | 'easeIn' | 'easeOut' | 'easeInOut' | 'linear';
}

const NAMED_EASE: Record<string, MotionSpec['ease']> = {
  'ease-in': 'easeIn',
  'ease-out': 'easeOut',
  'ease-in-out': 'easeInOut',
  ease: 'easeInOut',
  linear: 'linear',
};

/** Parses a motion token ("180ms cubic-bezier(...)" or { duration, easing }) for Framer Motion. */
export function motion(name: string): MotionSpec {
  const raw = (tokens.motion as TokenTree | undefined)?.[name];
  if (raw === undefined) throw new Error(`unknown motion token "${name}"`);
  const text = isTree(raw) ? `${String(raw.duration)} ${String(raw.easing)}` : String(raw);
  const ms = /(\d+(?:\.\d+)?)ms/.exec(text);
  const bezier = /cubic-bezier\(([^)]+)\)/.exec(text);
  const named = Object.keys(NAMED_EASE).find((k) => new RegExp(`(^|\\s)${k}($|\\s)`).test(text));
  return {
    duration: ms ? Number(ms[1]) / 1000 : 0.2,
    ease: bezier
      ? (bezier[1]!.split(',').map((n) => Number(n.trim())) as MotionSpec['ease'])
      : (NAMED_EASE[named ?? 'ease-out'] ?? 'easeOut'),
  };
}
