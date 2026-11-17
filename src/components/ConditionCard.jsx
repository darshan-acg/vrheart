import { LEVEL_STYLE } from '../lib/condition.js'
import { Icon, card, eyebrow } from './ui.jsx'

const RANGES = [
  ['No pulse', 'bg-rose-500'],
  ['Severe low', 'bg-rose-500'],
  ['Low', 'bg-amber-400'],
  ['Normal', 'bg-emerald-400'],
  ['High', 'bg-amber-400'],
  ['Severe high', 'bg-rose-500'],
]
const RANGE_INDEX = { 'no-pulse': 0, 'severe-bradycardia': 1, bradycardia: 2, normal: 3, tachycardia: 4, 'severe-tachycardia': 5 }

export default function ConditionCard({ condition, compact = false }) {
  if (!condition) return <section className={card + ' shrink-0 p-5'}>
    <div className={eyebrow}>Heart condition</div>
    <p className="mt-2 text-sm text-slate-500">Waiting for a heart-rate reading…</p>
  </section>

  const style = LEVEL_STYLE[condition.level]
  const index = RANGE_INDEX[condition.id]
  return <section role={condition.level === 'critical' ? 'alert' : 'status'}
    className={card + ' relative shrink-0 overflow-hidden p-5 ' + (condition.level === 'critical' ? 'border-rose-500/40' : '')}>
    {condition.level === 'critical' && <div className="pointer-events-none absolute inset-0 animate-pulse bg-rose-600/10"/>}
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <span className={eyebrow}>Heart condition</span>
        <span className={'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ' + style.chip}>{condition.level}</span>
      </div>
      <h2 className={'mt-2 text-xl font-semibold ' + style.text}>{condition.title}</h2>
      <p className="mt-1 text-sm text-slate-300">{condition.summary}</p>
      {!compact && <p className="mt-2 text-sm text-slate-400">{condition.advice}</p>}

      <div className="mt-4 grid grid-cols-6 gap-1" aria-hidden="true">
        {RANGES.map(([name, color], i) => <div key={name} className="min-w-0">
          <div className={'h-1.5 rounded-full ' + (i === index ? color : 'bg-white/10')}/>
          {!compact && <div className={'mt-1 truncate text-[10px] ' + (i === index ? 'text-white' : 'text-slate-600')}>{name}</div>}
        </div>)}
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-3">
        <span className={'grid size-8 shrink-0 place-items-center rounded-xl bg-white/5 ' + style.text}><Icon name="drop" className="size-4"/></span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-200">3D animation</div>
          <p className="text-xs text-slate-400">{condition.animation}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Based on heart rate only. A heart rate cannot detect a blocked artery or confirm a heart attack — the blockage is an illustration, not a diagnosis.
      </p>
    </div>
  </section>
}
