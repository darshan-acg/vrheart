import { Icon, Waveform, card, eyebrow } from './ui.jsx'

export default function HistoryView({ history, selected, setSelected, onClear, storageError }) {
  const strip = history.find((row) => row.timestamp === selected)
  return <div className="grid grid-cols-1 gap-4">
    <section className={card + ' flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6'}>
      <div>
        <div className={eyebrow}>Recorded strips</div>
        <h2 className="mt-1 text-xl font-semibold text-white">ECG history</h2>
        <p className="mt-1 max-w-xl text-sm text-slate-500">A six-second strip is saved about every ten seconds once the stream is filled. Up to 36 strips are kept in this browser.</p>
      </div>
      <button onClick={onClear} disabled={!history.length}
        className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5 disabled:opacity-40">
        <Icon name="trash" className="size-4"/>Clear history
      </button>
      {storageError && <p className="w-full text-sm text-amber-200">Browser storage is unavailable. History is available until the page closes.</p>}
    </section>

    {strip && <section key={strip.timestamp} className={card + ' animate-fade-up p-4 sm:p-6'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{new Date(strip.timestamp).toLocaleString()}</h3>
          <p className="text-sm text-slate-500">{strip.bpm} BPM · {strip.profile} rhythm</p>
        </div>
        <button onClick={() => setSelected(null)} aria-label="Close strip" className="grid size-9 place-items-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/10"><Icon name="x" className="size-4"/></button>
      </div>
      <Waveform samples={strip.samples} label="Recorded simulated ECG waveform"/>
    </section>}

    {history.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {history.map((row) => {
        const on = row.timestamp === selected
        return <button key={row.timestamp} onClick={() => setSelected(on ? null : row.timestamp)} aria-pressed={on}
          className={card + ' p-3 text-left transition hover:border-white/15 ' + (on ? 'ring-1 ring-teal-300/40' : '')}>
          <Waveform samples={row.samples} label="Recorded strip preview" className="h-16" compact/>
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-sm font-medium text-slate-200">{new Date(row.timestamp).toLocaleTimeString()}</span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 capitalize">{row.profile}</span>
              <span className="font-mono text-sm font-semibold text-white">{row.bpm}<span className="ml-0.5 text-[10px] text-slate-500">BPM</span></span>
            </span>
          </div>
        </button>
      })}
    </div> : <section className={card + ' grid place-items-center p-12 text-center'}>
      <span className="grid size-12 place-items-center rounded-2xl bg-white/5 text-slate-400"><Icon name="history"/></span>
      <p className="mt-3 font-medium text-slate-200">Waiting for the first strip…</p>
      <p className="mt-1 text-sm text-slate-500">Keep the simulator streaming for about ten seconds.</p>
    </section>}
  </div>
}
