import type { CSSProperties } from 'react';

export interface IndraMarkProps {
  /** Width and height in px. The mark is always square. */
  size?: number;
  /** Tints the whole mark, e.g. `--blocked` on a failed boot check. */
  color?: string;
  style?: CSSProperties;
  className?: string;
}

// Spec §3.1: a ring above a stadium, on a 24-unit grid, which also reads as a
// lowercase "i". Every number below is load-bearing — do not round or nudge
// them for "alignment"; the 1.7-unit gap between the ring and the stadium is
// explicitly called out as never-compress.
const STROKE_WIDTH = 2.6;
const RING_CX = 12;
const RING_CY = 5.4;
const RING_R = 3.5;
const RING_DOT_R = 1.15;
const STADIUM_X = 8.5;
const STADIUM_Y = 10.6;
const STADIUM_W = 7;
const STADIUM_H = 11;
const STADIUM_RX = 3.5;

export function IndraMark({ size = 24, color = 'currentColor', style, className }: IndraMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="INDRA"
      className={className}
      style={style}
    >
      <circle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={RING_CX} cy={RING_CY} r={RING_DOT_R} fill={color} />
      <rect x={STADIUM_X} y={STADIUM_Y} width={STADIUM_W} height={STADIUM_H} rx={STADIUM_RX} fill={color} />
    </svg>
  );
}
