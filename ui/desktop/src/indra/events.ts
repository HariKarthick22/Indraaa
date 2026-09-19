// Mirrors the Rust enum in crates/indra/src/events/types.rs, which is the
// source of truth. Where INDRA-system-and-ui-design.md §2.2 sketches a richer
// union, the Rust enum wins: it has no boot.step / turn.start / text.delta /
// turn.end variants, tool.call carries a flat `sandbox_backend` string rather
// than a `sandbox` object, citation's payload field is `source` (not `ref`),
// context.delta has no added/dropped lists, and context.compacted reports a
// `dropped_count` rather than kept/dropped lists.

export interface SourceBox {
  doc_id: string;
  version: string;
  page: number;
  bbox: [number, number, number, number];
  conf: number;
}

export interface PlanStep {
  id: string;
  label: string;
  tool: string | null;
}

export type FitKind = 'comfortable' | 'tight' | 'degraded';

// Rust types ModelSelected.fit as serde_json::Value, so this shape is the UI's
// projection of what the backend actually writes. Treat `fit` as untrusted.
export interface Fit {
  kind: FitKind;
  warning?: string;
}

export type IndraEvent =
  | { t: 'plan.proposed'; steps: PlanStep[] }
  | { t: 'plan.revised'; after_step: string; steps: PlanStep[]; reason: string }
  | { t: 'step.state'; step_id: string; state: string; ms?: number }
  | { t: 'model.selected'; model_id: string; reason: string; fit: Fit }
  | {
      t: 'tool.call';
      call_id: string;
      step_id: string;
      name: string;
      args: unknown;
      sandbox_backend: string;
    }
  | {
      t: 'tool.result';
      call_id: string;
      ok: boolean;
      ms: number;
      summary: string;
      bytes: number;
      citations: SourceBox[];
    }
  | { t: 'citation'; span: [number, number]; source: SourceBox }
  | { t: 'context.delta'; session_bytes: number; budget_bytes: number }
  | { t: 'context.compacted'; from_turns: number; to_bytes: number; dropped_count: number }
  | { t: 'memory.touch'; node_ids: string[]; op: string }
  | { t: 'egress.attempt'; url: string; blocked: boolean; at: string }
  | { t: 'verify.recompute'; claim: number; computed: number; verdict: string }
  | { t: 'guard.blocked'; resource: string; reason: string };

export type IndraEventTag = IndraEvent['t'];

const KNOWN_TAGS: ReadonlySet<string> = new Set<IndraEventTag>([
  'plan.proposed',
  'plan.revised',
  'step.state',
  'model.selected',
  'tool.call',
  'tool.result',
  'citation',
  'context.delta',
  'context.compacted',
  'memory.touch',
  'egress.attempt',
  'verify.recompute',
  'guard.blocked',
]);

// An unrecognised tag means the Rust enum gained a variant this build does not
// know about. Dropping it keeps an older UI usable against a newer backend.
export function parseIndraEvent(value: unknown): IndraEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  const tag = (value as { t?: unknown }).t;
  if (typeof tag !== 'string' || !KNOWN_TAGS.has(tag)) return null;
  return value as IndraEvent;
}
