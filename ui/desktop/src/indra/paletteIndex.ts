/**
 * One flat index behind the ⌘K palette.
 *
 * Spec §4: the palette is the real navigation, which is why the left rail
 * needs only five icons. Everything reachable — destinations, sessions,
 * documents, skills, recipes, themes, retrieval scopes — is a peer in a
 * single list, searched by one fuzzy pass. No categories to choose first,
 * no per-kind search boxes.
 */

export type PaletteKind =
  | 'destination'
  | 'session'
  | 'document'
  | 'skill'
  | 'recipe'
  | 'theme'
  | 'scope';

export interface PaletteEntry {
  id: string;
  label: string;
  kind: PaletteKind;
  hint?: string;
  run: () => void;
}

/** A half-open `[start, end)` slice of the label that the query matched. */
export type MatchRange = [number, number];

export interface FuzzyMatch {
  score: number;
  ranges: MatchRange[];
}

export interface PaletteMatch {
  entry: PaletteEntry;
  score: number;
  ranges: MatchRange[];
}

const SCORE_CHAR = 1;
const SCORE_CONTIGUOUS = 8;
const SCORE_WORD_START = 6;
const SCORE_FIRST_CHAR = 4;
const PENALTY_LEADING_GAP = 0.1;
const PENALTY_LENGTH = 0.01;

function isWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  const previous = text[index - 1];
  return !/[a-z0-9]/i.test(previous);
}

/**
 * Greedy subsequence match. Every query character must appear in order;
 * contiguous runs and word starts score higher, so `ndt` finds
 * `/ndt-review` ahead of `node detach target`, and a leading slash never
 * has to be typed.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return { score: 0, ranges: [] };

  const haystack = text.toLowerCase();
  const ranges: MatchRange[] = [];
  let score = 0;
  let cursor = 0;
  let previousIndex = -2;
  let firstIndex = -1;

  for (const char of needle) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return null;

    if (firstIndex === -1) firstIndex = index;

    score += SCORE_CHAR;
    if (index === previousIndex + 1) score += SCORE_CONTIGUOUS;
    if (isWordBoundary(text, index)) score += SCORE_WORD_START;
    if (index === 0) score += SCORE_FIRST_CHAR;

    const last = ranges[ranges.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else ranges.push([index, index + 1]);

    previousIndex = index;
    cursor = index + 1;
  }

  score -= firstIndex * PENALTY_LEADING_GAP;
  score -= text.length * PENALTY_LENGTH;

  return { score, ranges };
}

/**
 * Filter and rank the flat index. An empty query returns everything in
 * index order — the palette opens on a usable list, not on nothing.
 * Ties keep index order, so the list never reshuffles for no reason.
 */
export function searchPalette(entries: readonly PaletteEntry[], query: string): PaletteMatch[] {
  const needle = query.trim();

  if (needle.length === 0) {
    return entries.map((entry) => ({ entry, score: 0, ranges: [] }));
  }

  const matches: { match: PaletteMatch; order: number }[] = [];

  entries.forEach((entry, order) => {
    const labelMatch = fuzzyMatch(needle, entry.label);
    const hintMatch = entry.hint ? fuzzyMatch(needle, entry.hint) : null;

    if (labelMatch) {
      matches.push({ match: { entry, score: labelMatch.score, ranges: labelMatch.ranges }, order });
      return;
    }

    if (hintMatch) {
      // A hint match is real but weaker than a label match — the label is
      // what the person is reading.
      matches.push({ match: { entry, score: hintMatch.score - 10, ranges: [] }, order });
    }
  });

  matches.sort((a, b) => b.match.score - a.match.score || a.order - b.order);

  return matches.map((m) => m.match);
}

export interface PaletteDestinationSource {
  id: string;
  label: string;
  go: () => void;
}

export interface PaletteSessionSource {
  id: string;
  title: string;
  hint?: string;
  open: () => void;
}

export interface PaletteDocumentSource {
  id: string;
  title: string;
  page?: number;
  open: () => void;
}

export interface PaletteSkillSource {
  name: string;
  description?: string;
  run: () => void;
}

export interface PaletteRecipeSource {
  id: string;
  title: string;
  hint?: string;
  run: () => void;
}

export interface PaletteThemeSource {
  id: string;
  label: string;
  apply: () => void;
}

export interface PaletteScopeSource {
  id: string;
  label: string;
  hint?: string;
  apply: () => void;
}

export interface PaletteSources {
  destinations?: readonly PaletteDestinationSource[];
  sessions?: readonly PaletteSessionSource[];
  documents?: readonly PaletteDocumentSource[];
  skills?: readonly PaletteSkillSource[];
  recipes?: readonly PaletteRecipeSource[];
  themes?: readonly PaletteThemeSource[];
  scopes?: readonly PaletteScopeSource[];
}

/**
 * Flatten every source into one index. Ids are namespaced by kind because
 * a session and a destination may well share an underlying id, and the
 * palette uses the entry id for `aria-activedescendant`.
 */
export function buildPaletteIndex(sources: PaletteSources): PaletteEntry[] {
  const entries: PaletteEntry[] = [];

  for (const destination of sources.destinations ?? []) {
    entries.push({
      id: `destination:${destination.id}`,
      label: `Go to ${destination.label}`,
      kind: 'destination',
      run: destination.go,
    });
  }

  for (const session of sources.sessions ?? []) {
    entries.push({
      id: `session:${session.id}`,
      label: session.title,
      kind: 'session',
      hint: session.hint,
      run: session.open,
    });
  }

  for (const document of sources.documents ?? []) {
    entries.push({
      id: `document:${document.id}`,
      label: document.title,
      kind: 'document',
      hint: document.page === undefined ? undefined : `page ${document.page}`,
      run: document.open,
    });
  }

  for (const skill of sources.skills ?? []) {
    entries.push({
      id: `skill:${skill.name}`,
      label: `/${skill.name}`,
      kind: 'skill',
      hint: skill.description,
      run: skill.run,
    });
  }

  for (const recipe of sources.recipes ?? []) {
    entries.push({
      id: `recipe:${recipe.id}`,
      label: recipe.title,
      kind: 'recipe',
      hint: recipe.hint,
      run: recipe.run,
    });
  }

  for (const theme of sources.themes ?? []) {
    entries.push({
      id: `theme:${theme.id}`,
      label: theme.label,
      kind: 'theme',
      run: theme.apply,
    });
  }

  for (const scope of sources.scopes ?? []) {
    entries.push({
      id: `scope:${scope.id}`,
      label: scope.label,
      kind: 'scope',
      hint: scope.hint,
      run: scope.apply,
    });
  }

  return entries;
}
