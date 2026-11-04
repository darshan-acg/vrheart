import { useEffect, useRef, useState } from 'react'
import { HISTORY_KEY, INITIAL, WINDOW, readHistory, subscribeToDemo } from './lib/ecg.js'
import { Icon, BeatingHeart } from './components/ui.jsx'
import AnatomyView from './components/AnatomyView.jsx'
import MonitorView from './components/MonitorView.jsx'
import HistoryView from './components/HistoryView.jsx'

const TABS = [
  { id: 'anatomy', name: '3D Anatomy', short: 'Anatomy', icon: 'cube' },
  { id: 'monitor', name: 'Live monitor', short: 'Monitor', icon: 'pulse' },
  { id: 'history', name: 'History', short: 'History', icon: 'history' },
]

function App() {
  const [tab, setTab] = useState('anatomy')
  const [profile, setProfile] = useState('baseline')
  const [link, setLink] = useState('streaming')
  const [frame, setFrame] = useState(INITIAL)
  const [history, setHistory] = useState(readHistory)
  const [selected, setSelected] = useState(null)
  const [storageError, setStorageError] = useState(false)
  const [limits, setLimits] = useState({ low: '55', high: '105' })
  const beatRef = useRef(null)
  const savedAt = useRef(null)

  useEffect(() => {
    beatRef.current = null
    setFrame(INITIAL)
    if (link === 'recovering') {
      const timer = setTimeout(() => setLink('streaming'), 1000)
      return () => clearTimeout(timer)
    }
    if (link !== 'streaming') return
    return subscribeToDemo(profile, (snapshot) => {
      beatRef.current = { lastBeat: snapshot.lastBeat, bpm: snapshot.bpm }
      setFrame(snapshot)
      if (snapshot.bpm !== null && snapshot.samples.length === WINDOW &&
          (savedAt.current === null || snapshot.timestamp - savedAt.current >= 10000)) {
        savedAt.current = snapshot.timestamp
        setHistory((rows) => [{ ...snapshot, profile }, ...rows].slice(0, 36))
      }
    })
  }, [link, profile])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      setStorageError(false)
    } catch { setStorageError(true) }
  }, [history])

  const low = Number(limits.low)
  const high = Number(limits.high)
  const validLimits = limits.low !== '' && limits.high !== '' && low >= 1 && high <= 250 && low < high
  const current = link === 'streaming' ? frame : INITIAL
  const alert = validLimits && current.bpm !== null &&
    (current.bpm < low ? 'Below demo limit' : current.bpm > high ? 'Above demo limit' : '')
  const status = link === 'offline' ? 'Disconnected' : link === 'recovering' ? 'Reconnecting…' :
    current.timestamp === null ? 'Starting…' : 'Streaming'

  return <div className="min-h-svh text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#05070e]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 shadow-[0_8px_30px_-6px_rgba(244,63,94,0.7)]">
            <Icon name="pulse" className="size-5 text-white"/>
          </span>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight text-white">CardioTwin</div>
            <div className="text-[11px] text-slate-500">Digital heart twin</div>
          </div>
        </div>
        <nav className="ml-6 hidden items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 md:flex" aria-label="Sections">
          {TABS.map(({ id, name, icon }) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
            className={'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ' +
              (tab === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}>
            <Icon name={icon} className="size-4"/>{name}
          </button>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200 lg:inline">SIMULATED · EDUCATIONAL</span>
          <button onClick={() => setTab('monitor')} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pr-3 pl-2 hover:bg-white/[0.07]">
            <BeatingHeart bpm={current.bpm} className="size-5"/>
            <span className="font-mono text-sm font-semibold text-white tabular-nums">{current.bpm ?? '—'}</span>
            <span className="text-[11px] text-slate-500">BPM</span>
            <span className={'size-1.5 rounded-full ' + (status === 'Streaming' ? 'bg-emerald-400' : 'bg-slate-500')} title={status}/>
          </button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1600px] px-3 pt-3 pb-28 sm:px-6 sm:pt-5 md:pb-8">
      <AnatomyView active={tab === 'anatomy'} beatRef={beatRef} frame={current}/>
      {tab === 'monitor' && <MonitorView current={current} status={status} link={link} setLink={setLink}
        profile={profile} setProfile={setProfile} limits={limits} setLimits={setLimits} validLimits={validLimits} alert={alert}/>}
      {tab === 'history' && <HistoryView history={history} selected={selected} setSelected={setSelected} storageError={storageError}
        onClear={() => { setHistory([]); setSelected(null); savedAt.current = Date.now() }}/>}
      <footer className={'mt-6 text-center text-xs text-slate-600 ' + (tab === 'anatomy' ? 'lg:hidden' : '')}>
        Illustrative anatomy with a synthetic ECG and configurable demo thresholds. For educational visualisation only.
      </footer>
    </main>

    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-[#05070e]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Sections">
      <div className="grid grid-cols-3">
        {TABS.map(({ id, short, icon }) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
          className={'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ' + (tab === id ? 'text-rose-300' : 'text-slate-500')}>
          <span className={'grid h-7 w-12 place-items-center rounded-full transition ' + (tab === id ? 'bg-rose-500/15' : '')}><Icon name={icon} className="size-5"/></span>
          {short}
        </button>)}
      </div>
    </nav>
  </div>
}

export default App
