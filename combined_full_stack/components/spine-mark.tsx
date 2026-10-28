// AI : Spine logo mark — vertical spine line with 3 vertebra node bars.
// AI : Mirrors the CSS design in logo/index.html; sized for h-7 w-7 nav/login boxes.
// AI : overflow="visible" lets the wide middle node bleed 1px outside the viewBox without clipping.

type SpineMarkSize = "sm" | "md"

interface SpineMarkProps {
  size?: SpineMarkSize
  onLight?: boolean
  className?: string
}

// AI : w/h are the viewBox dimensions; the mark draws within these bounds.
const SIZE_CONFIG = {
  sm: { w: 12, h: 18, spineW: 2, nodeH: 2, nodeW: 10, wideNodeW: 12 },
  md: { w: 16, h: 24, spineW: 2, nodeH: 2.5, nodeW: 13, wideNodeW: 16 },
} satisfies Record<SpineMarkSize, { w: number; h: number; spineW: number; nodeH: number; nodeW: number; wideNodeW: number }>

// AI : nav / inline icon — inherits text color like lucide icons (linear spine, not a fork).
export function SpineNavIcon({ className }: { className?: string }) {
  const { w, h, spineW, nodeH, nodeW, wideNodeW } = SIZE_CONFIG.sm
  const cx = w / 2

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      aria-hidden="true"
      overflow="visible"
      className={className}
    >
      <rect x={cx - spineW / 2} y={0} width={spineW} height={h} rx={1} fill="currentColor" opacity={0.55} />
      <rect x={cx - nodeW / 2} y={3} width={nodeW} height={nodeH} rx={1} fill="currentColor" opacity={0.45} />
      <rect x={cx - wideNodeW / 2} y={h / 2 - nodeH / 2} width={wideNodeW} height={nodeH} rx={1} fill="currentColor" />
      <rect x={cx - nodeW / 2} y={h - 3 - nodeH} width={nodeW} height={nodeH} rx={1} fill="currentColor" opacity={0.45} />
    </svg>
  )
}

export function SpineMark({ size = "sm", onLight = false, className }: SpineMarkProps) {
  const { w, h, spineW, nodeH, nodeW, wideNodeW } = SIZE_CONFIG[size]
  const cx = w / 2

  const fill = onLight ? "#18181b" : "#fafafa"
  const dimOpacity = 0.45
  const spineOpacity = 0.55

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      aria-hidden="true"
      overflow="visible"
      className={className}
    >
      {/* AI : spine line */}
      <rect x={cx - spineW / 2} y={0} width={spineW} height={h} rx={1} fill={fill} opacity={spineOpacity} />
      {/* AI : top node — dimmed */}
      <rect x={cx - nodeW / 2} y={3} width={nodeW} height={nodeH} rx={1} fill={fill} opacity={dimOpacity} />
      {/* AI : middle node — full brightness, full width */}
      <rect x={cx - wideNodeW / 2} y={h / 2 - nodeH / 2} width={wideNodeW} height={nodeH} rx={1} fill={fill} />
      {/* AI : bottom node — dimmed */}
      <rect x={cx - nodeW / 2} y={h - 3 - nodeH} width={nodeW} height={nodeH} rx={1} fill={fill} opacity={dimOpacity} />
    </svg>
  )
}

// AI : SpineLogoBox — the boxed logo used in nav header and login. Single constant, no duplication.
// AI : Always dark box + white mark so it's theme-independent (never inherits the green primary).
export function SpineLogoBox({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#0a0a0a] ${className ?? ""}`}
    >
      <SpineMark size="sm" onLight={false} />
    </div>
  )
}
