import { formatTime } from '../lib/ecg.js'
import { Icon, Segmented, Waveform, BeatingHeart, card, eyebrow } from './ui.jsx'
import ConditionCard from './ConditionCard.jsx'

const RHYTHMS = [{ id: 'baseline', name: 'Baseline' }, { id: 'slow', name: 'Slow' }, { id: 'fast', name: 'Fast' }]

function Metric({ title, value, unit, detail, icon, tone = 'text-slate-300' }) {
  return <div className={card + ' p-4 sm:p-5'}>
    <div className="flex items-center justify-between">
      <span className={eyebrow}>{title}</span>
      <span className={'grid size-8 place-items-center rounded-xl bg-white/5 ' + tone}><Icon name={icon} className="size-4"/></span>
    </div>
    <div className="mt-3 text-2xl font-semibold text-white tabular-nums sm:text-3xl">{value}<span className="ml-1 text-sm font-medium text-slate-500">{unit}</span></div>
    <div className="mt-1 truncate text-xs text-slate-500">{detail}</div>
  </div>
}

export default function MonitorView({ current, status, link, setLink, profile, setProfile, live, condition, limits, setLimits, validLimits, alert }) {
  const streaming = status === 'Streaming'
  const isLive = live.bpm !== null
  return <div className="grid grid-cols-1 gap-4">
    <ConditionCard condition={condition}/>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className={card + ' relative overflow-hidden p-6'}>
        <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-rose-500/20 blur-3xl"/>
        <div className="flex items-center justify-between">
          <span className={eyebrow}>Heart rate · {isLive ? 'Firebase live' : 'simulated'}</span>
          <span role="status" className={'flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ' +
            (streaming ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-slate-400')}>
            <span className={'size-1.5 rounded-full ' + (streaming ? 'animate-pulse bg-emerald-400' : 'bg-slate-500')}/>{status}
          </span>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <BeatingHeart bpm={current.bpm} className="size-14 drop-shadow-[0_0_18px_rgba(244,63,94,0.7)]"/>
          <div>
            <div className="text-6xl font-semibold tracking-tight text-white tabular-nums">{current.bpm ?? '—'}</div>
            <div className="text-sm text-slate-400">beats per minute</div>
          </div>
        </div>
        <p className={'mt-4 text-sm ' + (alert ? 'text-rose-300' : 'text-slate-500')}>
          {alert || (current.bpm === null ? 'Waiting for two R peaks…' : validLimits ? 'Within your limits' : 'Check alert settings')}
        </p>
        <p className={'mt-2 text-xs ' + (live.error ? 'text-amber-300' : 'text-slate-500')}>
          {live.error ? 'Firebase error: ' + live.error
            : isLive ? 'Last Firebase update ' + formatTime(live.receivedAt)
            : 'Waiting for bpm from Firebase… showing simulated rate'}
        </p>
        <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
          {!isLive && <>
            <div className="text-xs font-medium text-slate-400">Demo rhythm</div>
            <Segmented options={RHYTHMS} value={profile} onChange={setProfile} label="Demo rhythm"/>
          </>}
          <button disabled={link === 'recovering'} onClick={() => setLink(link === 'streaming' ? 'offline' : 'recovering')}
            className={'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ' +
              (link === 'streaming' ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15')}>
            <Icon name="signal" className="size-4"/>
            {link === 'streaming' ? 'Simulate disconnect' : link === 'recovering' ? 'Reconnecting…' : 'Reconnect simulator'}
          </button>
        </div>
      </section>

      <section className={card + ' p-4 sm:p-6'}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><div className={eyebrow}>{isLive ? 'Paced to live BPM · illustrative trace' : 'Lead II · simulated'}</div><h2 className="mt-1 text-xl font-semibold text-white">Live ECG</h2></div>
          <span className="font-mono text-xs text-slate-500">Updated {formatTime(current.timestamp)}</span>
        </div>
        <Waveform samples={current.samples} label="Live simulated ECG waveform" className="h-48 sm:h-64"/>
        <p className="mt-3 text-xs text-slate-500">The 3D heart contracts on each detected R peak, and its conduction system fires in step with this trace.</p>
      </section>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Metric title="Heart rate" value={current.bpm ?? '—'} unit="BPM" icon="heart" tone="text-rose-300"
        detail={isLive ? 'bpm from Firebase' : current.bpm === null ? 'Waiting for two R peaks' : 'From R–R interval'}/>
      {live.ecgValue !== null
        ? <Metric title="Sensor ECG" value={live.ecgValue} unit="raw" icon="pulse" tone="text-teal-300"
            detail="ecg_value from Firebase"/>
        : <Metric title="ECG sample" value={current.latest === null ? '—' : current.latest.toFixed(3)} unit="mV" icon="pulse" tone="text-teal-300"
            detail="Latest synthetic reading"/>}
      <Metric title="Beats" value={link === 'streaming' ? current.beats : '—'} icon="bolt" tone="text-amber-300"
        detail={'Last peak ' + formatTime(current.lastBeat)}/>
      <Metric title="Update delay" value={current.lag ?? '—'} unit="ms" icon="signal" tone="text-sky-300"
        detail="Timer drift · 50 ms batches"/>
    </div>

    <section className={card + ' p-4 sm:p-6'}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-amber-400/10 text-amber-300"><Icon name="bell"/></span>
          <div><h2 className="font-semibold text-white">Alert limits</h2><p className="text-xs text-slate-500">Flag the heart rate outside this range</p></div>
        </div>
        <div className="flex flex-wrap gap-3">
          {[['low', 'Low'], ['high', 'High']].map(([key, label]) =>
            <label key={key} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 py-1.5 pr-3 pl-3.5 text-sm text-slate-400 focus-within:border-rose-400/40">
              {label}
              <input type="number" min="1" max="250" value={limits[key]} onChange={(event) => setLimits({ ...limits, [key]: event.target.value })}
                className="w-16 bg-transparent text-right font-mono text-base font-semibold text-white outline-none"/>
              <span className="text-xs text-slate-500">BPM</span>
            </label>)}
        </div>
      </div>
      {!validLimits && <p className="mt-4 text-sm text-amber-200">Set limits from 1 to 250 BPM with the low limit below the high limit.</p>}
      {alert && <p role="alert" className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{alert} · {isLive ? 'Live' : 'Simulated'} heart rate is outside your configured range.</p>}
    </section>
  </div>
}
