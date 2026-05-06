import {
  TrendingUp, TrendingDown, GitCompareArrows, Share, ListChecks, ArrowRight, ArrowLeft,
  ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown, AlertTriangle, Bell,
  LayoutDashboard, Building2, ShieldCheck, FolderTree, Scale, MailCheck, Sparkles,
  History, ScrollText, UsersRound, KeyRound, Play, Download, ExternalLink,
  Check, X, Zap, CalendarRange, Filter, Link, OctagonX,
} from 'lucide-react'

export const ICONS = {
  'trending-up': TrendingUp, 'trending-down': TrendingDown,
  'git-compare-arrows': GitCompareArrows, 'share': Share,
  'list-checks': ListChecks, 'arrow-right': ArrowRight, 'arrow-left': ArrowLeft,
  'chevron-right': ChevronRight, 'chevron-down': ChevronDown, 'chevron-up': ChevronUp,
  'chevrons-up-down': ChevronsUpDown, 'alert-triangle': AlertTriangle, 'bell': Bell,
  'layout-dashboard': LayoutDashboard, 'building-2': Building2, 'shield-check': ShieldCheck,
  'folder-tree': FolderTree, 'scale': Scale, 'mail-check': MailCheck, 'sparkles': Sparkles,
  'history': History, 'scroll-text': ScrollText, 'users-round': UsersRound, 'key-round': KeyRound,
  'play': Play, 'download': Download, 'external-link': ExternalLink,
  'check': Check, 'x': X, 'zap': Zap, 'calendar-range': CalendarRange,
  'filter': Filter, 'link': Link, 'octagon-x': OctagonX,
}

export function Icon({ name, size = 16, style }) {
  const Comp = ICONS[name]
  if (!Comp) return null
  return <Comp size={size} style={style} strokeWidth={1.75} />
}

export function Pill({ tone = 'neutral', icon, children, dot, style }) {
  const tones = {
    neutral:  { bg: 'var(--neutral-bg)', bd: 'var(--neutral-bd)', fg: 'var(--neutral-fg)' },
    info:     { bg: 'var(--info-bg)',    bd: 'var(--info-bd)',    fg: 'var(--info-fg)' },
    ok:       { bg: 'var(--ok-bg)',      bd: 'var(--ok-bd)',      fg: 'var(--ok-fg)' },
    warn:     { bg: 'var(--warn-bg)',    bd: 'var(--warn-bd)',    fg: 'var(--warn-fg)' },
    err:      { bg: 'var(--err-bg)',     bd: 'var(--err-bd)',     fg: 'var(--err-fg)' },
    critical: { bg: 'var(--sev-critical-bg)', bd: 'var(--sev-critical-bd)', fg: 'var(--sev-critical-fg)' },
    high:     { bg: 'var(--sev-high-bg)',     bd: 'var(--sev-high-bd)',     fg: 'var(--sev-high-fg)' },
    medium:   { bg: 'var(--sev-medium-bg)',   bd: 'var(--sev-medium-bd)',   fg: 'var(--sev-medium-fg)' },
    low:      { bg: 'var(--sev-low-bg)',      bd: 'var(--sev-low-bd)',      fg: 'var(--sev-low-fg)' },
    brand:    { bg: 'var(--brand-50)',   bd: 'var(--brand-100)',  fg: 'var(--brand-700)' },
  }[tone] || { bg: 'var(--neutral-bg)', bd: 'var(--neutral-bd)', fg: 'var(--neutral-fg)' }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 22, padding: '0 8px', borderRadius: 999,
      fontSize: 12, fontWeight: 500, lineHeight: 1,
      background: tones.bg, border: `1px solid ${tones.bd}`, color: tones.fg, ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: tones.fg }} />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

export function Btn({ variant = 'primary', icon, iconRight, children, onClick, size = 'md', style, disabled }) {
  const sizes = {
    sm: { h: 28, px: 10, fs: 13, gap: 6 },
    md: { h: 34, px: 14, fs: 13, gap: 8 },
    lg: { h: 40, px: 18, fs: 14, gap: 8 },
  }[size]
  const variants = {
    primary:   { bg: 'var(--brand-500)', fg: '#fff', bd: 'transparent', sh: 'var(--shadow-1)' },
    secondary: { bg: '#fff', fg: 'var(--fg-1)', bd: 'var(--border-2)', sh: 'var(--shadow-1)' },
    ghost:     { bg: 'transparent', fg: 'var(--fg-2)', bd: 'transparent', sh: 'none' },
    danger:    { bg: 'var(--sev-critical-fg)', fg: '#fff', bd: 'transparent', sh: 'var(--shadow-1)' },
  }[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: sizes.gap,
        height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: 'var(--r-md)',
        fontSize: sizes.fs, fontWeight: 500, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        background: variants.bg, color: variants.fg, border: `1px solid ${variants.bd}`,
        boxShadow: variants.sh, transition: '150ms', opacity: disabled ? 0.5 : 1, ...style,
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  )
}

export function Card({ children, padding = 24, style }) {
  return (
    <section style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-1)',
      borderRadius: 'var(--r-xl)', padding,
      boxShadow: 'var(--shadow-1)', ...style,
    }}>{children}</section>
  )
}

export function ScoreDonut({ value, max = 5, size = 220, label }) {
  const pct = Math.max(0, Math.min(1, value / max))
  const r = (size / 2) - 14
  const c = 2 * Math.PI * r
  const dash = c * pct
  const bandColor = value >= 4 ? 'var(--score-5)'
    : value >= 3 ? 'var(--score-3)'
    : value >= 2 ? 'var(--score-2)'
    : 'var(--score-0)'
  const bandLabel = label || (value >= 4 ? 'Maduro'
    : value >= 3 ? 'Aceitável'
    : value >= 2 ? 'Em risco'
    : 'Crítico')
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-1)" strokeWidth="14" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bandColor} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 56, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--fg-1)' }}>
          {value.toFixed(1)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>de {max.toFixed(1)}</div>
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: bandColor, padding: '3px 10px', border: `1px solid ${bandColor}`, borderRadius: 999 }}>
          {bandLabel}
        </div>
      </div>
    </div>
  )
}

export function ScoreBar({ value, max = 5, height = 6 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = value >= 4 ? 'var(--score-5)'
    : value >= 3 ? 'var(--score-3)'
    : value >= 2 ? 'var(--score-2)'
    : 'var(--score-0)'
  return (
    <div style={{ background: 'var(--border-1)', height, borderRadius: 999, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 400ms' }} />
    </div>
  )
}

export function MetricStat({ label, value, sub, tone = 'neutral' }) {
  const colorMap = {
    neutral: 'var(--fg-1)', ok: 'var(--ok-fg)', warn: 'var(--warn-fg)', err: 'var(--err-fg)',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="t-2xs">{label}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 24, lineHeight: '30px', letterSpacing: '-0.01em', color: colorMap[tone] || 'var(--fg-1)' }}>{value}</div>
      {sub && <div className="t-xs">{sub}</div>}
    </div>
  )
}

export function PageHeader({ kicker, title, subtitle, right, breadcrumb }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {breadcrumb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-3)' }}>
            {breadcrumb.map((b, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <Icon name="chevron-right" size={12} />}
                <span style={{ color: i === breadcrumb.length - 1 ? 'var(--fg-1)' : 'var(--fg-3)', fontWeight: i === breadcrumb.length - 1 ? 500 : 400 }}>{b}</span>
              </span>
            ))}
          </div>
        )}
        {kicker && <div className="t-2xs" style={{ color: 'var(--brand-600)' }}>{kicker}</div>}
        <h1 className="t-h1" style={{ margin: 0 }}>{title}</h1>
        {subtitle && <div className="t-sm" style={{ maxWidth: 720 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{right}</div>}
    </div>
  )
}
