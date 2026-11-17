import { WINDOW } from '../lib/ecg.js'

const ICONS = {
  heart: 'M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.7 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.5 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z',
  pulse: 'M3 12h4l2.5-6 4 12L16 9l1.5 3H21',
  history: 'M12 3.5a8.5 8.5 0 1 1-8.5 8.5M3.5 12V7.5M3.5 12H8M12 7.5V12l3 2',
  cube: 'M12 3 3.5 7.5 12 12l8.5-4.5L12 3zM3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  scan: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  cut: 'M12 3a9 9 0 1 0 0 18M12 3v18M15.5 4.5l1 1M18 7.5l.5 1M20.2 11v2M18 16.5l-.5 1M15.5 19.5l1-1',
  explode: 'M9 9 4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4',
  drop: 'M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z',
  tag: 'M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0zM8 6.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5',
  home: 'M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5',
  vr: 'M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-4l-2-2.5h-3L8.5 17h-4A1.5 1.5 0 0 1 3 15.5z',
  x: 'M6 6l12 12M18 6 6 18',
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2',
  focus: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  bolt: 'M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13',
  signal: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  down: 'M6 9l6 6 6-6',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
}

export function Icon({ name, className = 'size-5' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" className={className} aria-hidden="true"><path d={ICONS[name]}/></svg>
}

export const card = 'rounded-3xl border border-white/[0.07] bg-white/[0.035] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl'
export const eyebrow = 'text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase'

export function Waveform({ samples, label, className = 'h-44 sm:h-56', compact = false, color = '#4ff5cf' }) {
  const points = samples.map((value, i) =>
    [((WINDOW - samples.length + i) * 900 / (WINDOW - 1)).toFixed(1), (146 - value * 109).toFixed(1)].join(',')
  ).join(' ')
  const grid = Array.from({ length: 31 }, (_, i) => 'M' + i * 30 + ' 0v200').join(' ') +
    Array.from({ length: 6 }, (_, i) => 'M0 ' + i * 40 + 'h900').join(' ')
  return <div className={'overflow-hidden rounded-2xl border border-teal-400/10 bg-[#050f14]' + (compact ? '' : ' shadow-inner')}>
    <svg role="img" aria-label={label} viewBox="0 0 900 200" preserveAspectRatio="none" className={'block w-full ' + className}>
      <path d={grid} stroke="#0f2a30" fill="none" vectorEffect="non-scaling-stroke"/>
      <polyline points={points} stroke={color} strokeWidth={compact ? 1.5 : 2.2} vectorEffect="non-scaling-stroke" fill="none"
        strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color}aa)` }}/>
    </svg>
    {!compact && <div className="flex justify-between border-t border-teal-400/10 px-4 py-2 font-mono text-[11px] text-teal-200/60">
      <span>−6 s</span><span>Simulated mV · 100 Hz</span><span>now</span>
    </div>}
  </div>
}

export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return <div role="radiogroup" aria-label={label} className="inline-flex rounded-2xl border border-white/10 bg-slate-950/60 p-1 backdrop-blur-xl">
    {options.map(({ id, name, icon }) => {
      const on = value === id
      return <button key={id} role="radio" aria-checked={on} onClick={() => onChange(id)}
        className={'flex items-center gap-1.5 rounded-xl font-medium transition ' +
          (size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm') + ' ' +
          (on ? 'bg-white text-slate-950 shadow' : 'text-slate-300 hover:bg-white/10 hover:text-white')}>
        {icon && <Icon name={icon} className="size-4"/>}<span>{name}</span>
      </button>
    })}
  </div>
}

export function ToolButton({ icon, label, active = false, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled} aria-pressed={active} title={label} aria-label={label}
    className={'grid size-10 place-items-center rounded-2xl border backdrop-blur-xl transition disabled:opacity-40 ' +
      (active ? 'border-rose-400/50 bg-rose-500/25 text-rose-100 shadow-[0_0_24px_-6px_rgba(244,63,94,0.8)]'
        : 'border-white/10 bg-slate-950/60 text-slate-300 hover:bg-white/10 hover:text-white')}>
    <Icon name={icon} className="size-[18px]"/>
  </button>
}

export function BeatingHeart({ bpm, className = 'size-5' }) {
  return <span className={'inline-grid place-items-center text-rose-400 ' + (bpm ? 'animate-heartbeat' : 'opacity-50')}
    style={bpm ? { animationDuration: `${60 / bpm}s` } : undefined}>
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path fill="currentColor" d={ICONS.heart}/></svg>
  </span>
}
