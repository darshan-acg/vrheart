import { useEffect, useRef, useState } from 'react'
import HeartScene from '../heart/HeartScene.jsx'
import { CATEGORIES, PARTS, PART_BY_ID } from '../heart/anatomy.js'
import { Icon, Segmented, ToolButton, Waveform, BeatingHeart, card, eyebrow } from './ui.jsx'
import ConditionCard from './ConditionCard.jsx'
import { LEVEL_STYLE } from '../lib/condition.js'

const MODES = [
  { id: 'exterior', name: 'Exterior', icon: 'eye' },
  { id: 'xray', name: 'X-ray', icon: 'scan' },
  { id: 'cutaway', name: 'Cutaway', icon: 'cut' },
]
const CATEGORY = Object.fromEntries(CATEGORIES.map((category) => [category.id, category]))

function BloodTag({ blood }) {
  if (!blood) return null
  const oxygenated = blood === 'oxygenated'
  return <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ' +
    (oxygenated ? 'bg-rose-500/15 text-rose-200' : 'bg-indigo-500/15 text-indigo-200')}>
    <Icon name="drop" className="size-3.5"/>{oxygenated ? 'Oxygenated blood' : 'Deoxygenated blood'}
  </span>
}

function PartDetails({ part, onSelect, isolate, setIsolate }) {
  const index = PARTS.indexOf(part)
  const category = CATEGORY[part.category]
  const go = (step) => onSelect(PARTS[(index + step + PARTS.length) % PARTS.length].id)
  return <article key={part.id} className={card + ' animate-fade-up p-5'}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
          <span className="size-2 rounded-full" style={{ background: category.color }}/>{category.name}
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{part.name}</h2>
        <p className="mt-1 text-sm text-slate-300">{part.summary}</p>
      </div>
      <button onClick={() => onSelect(null)} aria-label="Close details"
        className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white">
        <Icon name="x" className="size-4"/>
      </button>
    </div>
    <p className="mt-4 text-sm leading-relaxed text-slate-400">{part.detail}</p>
    <dl className="mt-4 grid grid-cols-3 gap-2">
      {part.facts.map(([term, value]) => <div key={term} className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-3">
        <dt className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{term}</dt>
        <dd className="mt-1 text-[13px] leading-snug font-semibold text-slate-100">{value}</dd>
      </div>)}
    </dl>
    <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-sm text-amber-100/90">
      <Icon name="bolt" className="mt-0.5 size-4 shrink-0 text-amber-300"/>
      <p><span className="font-semibold text-amber-200">Watch: </span>{part.animation}</p>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <BloodTag blood={part.blood}/>
      {part.internal && <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-200">Internal structure</span>}
    </div>
    <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4">
      <button onClick={() => setIsolate(!isolate)} aria-pressed={isolate}
        className={'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ' +
          (isolate ? 'border-rose-400/40 bg-rose-500/15 text-rose-100' : 'border-white/10 text-slate-300 hover:bg-white/5')}>
        <Icon name="focus" className="size-4"/>{isolate ? 'Isolated' : 'Isolate part'}
      </button>
      <div className="ml-auto flex gap-1.5">
        <button onClick={() => go(-1)} aria-label="Previous structure" className="grid size-9 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10"><Icon name="left" className="size-4"/></button>
        <button onClick={() => go(1)} aria-label="Next structure" className="grid size-9 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10"><Icon name="right" className="size-4"/></button>
      </div>
    </div>
  </article>
}

function Overview({ onSelect, setMode, setExplode, setFlow, onVR, headset }) {
  const tours = [
    ['Follow a heartbeat', 'Watch the electrical impulse start in the SA node', 'bolt', () => onSelect('sa-node')],
    ['Separate every part', 'Pull the chambers, vessels and valves apart', 'explode', () => { onSelect(null); setExplode(1) }],
    ['See blood flow', 'Red is oxygen-rich, blue is oxygen-poor', 'drop', () => { onSelect(null); setFlow(true) }],
    ['Look inside', 'Cut the front away to reveal valves and walls', 'cut', () => { onSelect(null); setMode('cutaway') }],
  ]
  return <section className={card + ' p-5'}>
    <div className={eyebrow}>Interactive anatomy</div>
    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Explore the human heart</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-400">
      Tap any structure in 3D — or pick one below — to fly to it, isolate it and watch its own animation, synchronised to the live ECG.
    </p>
    <div className="mt-4 grid grid-cols-2 gap-2">
      {tours.map(([title, text, icon, action]) => <button key={title} onClick={action}
        className="group rounded-2xl border border-white/[0.07] bg-slate-950/40 p-3 text-left transition hover:border-rose-400/30 hover:bg-rose-500/[0.07]">
        <span className="grid size-8 place-items-center rounded-xl bg-rose-500/15 text-rose-300 transition group-hover:bg-rose-500/25"><Icon name={icon} className="size-4"/></span>
        <span className="mt-2 block text-sm font-semibold text-slate-100">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{text}</span>
      </button>)}
    </div>
    <button onClick={onVR}
      className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-fuchsia-400/25 bg-gradient-to-r from-rose-500/15 to-fuchsia-500/15 p-3 text-left transition hover:from-rose-500/25 hover:to-fuchsia-500/25">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-fuchsia-500/20 text-fuchsia-200"><Icon name="vr"/></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">Step inside in VR</span>
        <span className="block text-xs leading-snug text-slate-400">{headset
          ? 'Headset detected — explore with your controllers'
          : 'Put your phone in a VR viewer: look to select, tilt to look around'}</span>
      </span>
    </button>
  </section>
}

function StructureList({ selected, onSelect }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = PARTS.filter((part) => !q || part.name.toLowerCase().includes(q) || part.summary.toLowerCase().includes(q))
  return <section className={card + ' p-4'}>
    <div className="flex items-center justify-between px-1">
      <h3 className="text-sm font-semibold text-white">Structures</h3>
      <span className="text-xs text-slate-500">{PARTS.length} parts</span>
    </div>
    <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-slate-400 focus-within:border-rose-400/40">
      <Icon name="search" className="size-4"/>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search valves, nodes, vessels…"
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"/>
    </label>
    <div className="mt-3 space-y-4">
      {CATEGORIES.map((category) => {
        const items = matches.filter((part) => part.category === category.id)
        if (!items.length) return null
        return <div key={category.id}>
          <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            <span className="size-1.5 rounded-full" style={{ background: category.color }}/>{category.name}
          </div>
          <div className="flex flex-col gap-1">
            {items.map((part) => {
              const on = selected === part.id
              return <button key={part.id} onClick={() => onSelect(on ? null : part.id)} aria-pressed={on}
                className={'flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ' +
                  (on ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/[0.05]')}>
                <span className="size-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: part.color, color: part.color }}/>
                <span className="min-w-0 flex-1">
                  <span className={'block truncate text-sm font-medium ' + (on ? 'text-white' : 'text-slate-200')}>{part.name}</span>
                  <span className="block truncate text-xs text-slate-500">{part.summary}</span>
                </span>
                {part.internal && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">inside</span>}
              </button>
            })}
          </div>
        </div>
      })}
      {!matches.length && <p className="px-1 py-6 text-center text-sm text-slate-500">No structures match “{query}”.</p>}
    </div>
  </section>
}

export default function AnatomyView({ active, beatRef, frame, condition }) {
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('exterior')
  const [explode, setExplode] = useState(0)
  // Blood flow is on by default; it follows the live heart rate and freezes when there is no pulse.
  const [flow, setFlow] = useState(true)
  const [labels, setLabels] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [isolate, setIsolate] = useState(true)
  const [xr, setXR] = useState(false)
  const [vr, setVR] = useState(null)
  const engineRef = useRef(null)
  const fullscreened = useRef(false)
  const viewport = useRef(null)
  const details = useRef(null)
  const part = selected ? PART_BY_ID[selected] : null

  function choose(id, fromList = false) {
    setSelected(id)
    if (id) setAutoRotate(false)
    if (fromList && id && window.matchMedia('(max-width: 1023px)').matches) {
      viewport.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function enterVR() {
    if (xr) {
      engineRef.current?.enterVR()
      return
    }
    // Phone-viewer mode: request motion access (iOS), go fullscreen and prefer landscape.
    window.DeviceOrientationEvent?.requestPermission?.().catch(() => {})
    viewport.current?.requestFullscreen?.({ navigationUI: 'hide' }).then(() => {
      fullscreened.current = true
      screen.orientation?.lock?.('landscape').catch(() => {})
    }).catch(() => {})
    setAutoRotate(false)
    setVR('stereo')
  }

  function exitVR() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    screen.orientation?.unlock?.()
    fullscreened.current = false
    setVR(null)
  }

  function vrAction(action) {
    if (MODES.some(({ id }) => id === action)) setMode(action)
    else if (action === 'separate') setExplode((value) => value > 0.5 ? 0 : 1)
    else if (action === 'flow') setFlow((value) => !value)
    else if (action === 'isolate') setIsolate((value) => !value)
    else if (action === 'reset') { choose(null); setExplode(0); setMode('exterior') }
    else if (action === 'exit') exitVR()
  }

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && fullscreened.current) {
        fullscreened.current = false
        screen.orientation?.unlock?.()
        setVR((value) => value === 'stereo' ? null : value)
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const stereo = vr === 'stereo'

  return <div className={active ? 'grid grid-cols-1 gap-4 lg:h-[calc(100svh-6.5rem)] lg:grid-cols-[minmax(0,1fr)_380px]' : 'hidden'}>
    <section ref={viewport} className={stereo ? 'fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-[#04060c]'
      : 'relative h-[62svh] min-h-[400px] scroll-mt-20 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#04060c] lg:h-full'}>
      <HeartScene beatRef={beatRef} selected={selected} onSelect={(id) => choose(id)} mode={mode} explode={explode}
        flow={flow} labels={labels} autoRotate={autoRotate} isolate={isolate} active={active} stereo={stereo}
        engineRef={engineRef} onXRSupport={setXR} onVRAction={vrAction} onVRChange={setVR}/>

      {stereo && <>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/10"/>
        <button onClick={exitVR} className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-slate-950/80 px-4 py-2 text-sm font-medium text-white backdrop-blur-xl">
          <Icon name="x" className="size-4"/>Exit VR
        </button>
        <p className="animate-fade-out-late pointer-events-none absolute inset-x-6 bottom-6 mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-center text-sm text-slate-200 backdrop-blur-xl">
          Rest the centre dot on a structure — or tap it — to select it. For <b>X-ray</b>, <b>Cutaway</b>, <b>Separate</b> and more,
          use the menu just under the heart: hold the dot on a button until it fills, or tap the button.
        </p>
      </>}

      {!stereo && <>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
        <div className="pointer-events-auto">
          <div className="sm:hidden"><Segmented options={MODES} value={mode} onChange={setMode} label="View mode" size="sm"/></div>
          <div className="hidden sm:block"><Segmented options={MODES} value={mode} onChange={setMode} label="View mode"/></div>
        </div>
        <div className="pointer-events-auto flex flex-col gap-2">
          <ToolButton icon="tag" label="Show labels" active={labels} onClick={() => setLabels(!labels)}/>
          <ToolButton icon="drop" label="Show blood flow" active={flow} onClick={() => setFlow(!flow)}/>
          <ToolButton icon="rotate" label="Auto-rotate" active={autoRotate} onClick={() => setAutoRotate(!autoRotate)}/>
          <ToolButton icon="home" label="Reset view" onClick={() => { choose(null); setExplode(0); setMode('exterior'); engineRef.current?.reset() }}/>
          <ToolButton icon="vr" label={xr ? 'Enter VR headset' : 'VR mode (phone viewer)'} active={vr !== null} onClick={enterVR}/>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col gap-2 sm:inset-x-4 sm:bottom-4">
        {condition && condition.blockage > 0 && <div className={'pointer-events-none flex items-center gap-2 self-start rounded-2xl border px-3 py-2 text-xs font-semibold backdrop-blur-xl ' + LEVEL_STYLE[condition.level].chip}>
          <span className={'size-2 rounded-full animate-pulse ' + LEVEL_STYLE[condition.level].dot}/>
          {condition.title} · {condition.blockage >= 1 ? 'blocked artery shown' : 'narrowed artery shown'}
        </div>}
        {part && <div className="pointer-events-auto flex items-center gap-3 self-start rounded-2xl border border-white/10 bg-slate-950/70 py-2 pr-2 pl-3 backdrop-blur-xl lg:hidden">
          <span className="size-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: part.color, color: part.color }}/>
          <span className="text-sm font-semibold text-white">{part.name}</span>
          <button onClick={() => details.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-slate-200">Details<Icon name="down" className="size-3.5"/></button>
          <button onClick={() => choose(null)} aria-label="Deselect" className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-white/10"><Icon name="x" className="size-4"/></button>
        </div>}
        <div className="flex items-end justify-between gap-3">
          <label className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3.5 py-3 backdrop-blur-xl">
            <Icon name="explode" className="size-4 shrink-0 text-rose-300"/>
            <span className="shrink-0 text-xs font-semibold text-slate-200">Separate</span>
            <input type="range" min="0" max="1" step="0.01" value={explode} onChange={(event) => setExplode(Number(event.target.value))}
              className="range w-full" aria-label="Separate the heart into parts" style={{ '--value': `${explode * 100}%` }}/>
            <span className="w-9 shrink-0 text-right font-mono text-xs text-slate-400 tabular-nums">{Math.round(explode * 100)}%</span>
          </label>
          <div className="pointer-events-auto hidden w-64 shrink-0 rounded-2xl border border-white/10 bg-slate-950/70 p-3 backdrop-blur-xl md:block">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-300"><BeatingHeart bpm={frame.bpm} className="size-4"/>Synced ECG</span>
              <span className="font-mono text-sm font-semibold text-white tabular-nums">{frame.bpm ?? '—'}<span className="ml-1 text-[10px] text-slate-500">BPM</span></span>
            </div>
            <Waveform samples={frame.samples} label="Live simulated ECG" className="h-12" compact/>
          </div>
        </div>
      </div>

      {!part && explode === 0 && <p className="pointer-events-none absolute inset-x-0 bottom-24 hidden text-center text-xs text-slate-500 sm:block">
        Drag to rotate · Scroll to zoom · Click a structure to explore it
      </p>}
      {vr === 'headset' && <p className="absolute inset-x-0 top-20 mx-auto w-fit rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-4 py-1.5 text-xs font-medium text-fuchsia-100">
        Headset session active — put on your headset
      </p>}
      </>}
    </section>

    <aside ref={details} className="flex min-w-0 scroll-mt-20 flex-col gap-4 lg:overflow-y-auto lg:pr-1 lg:pb-2">
      <ConditionCard condition={condition} compact/>
      {part ? <PartDetails part={part} onSelect={(id) => choose(id, true)} isolate={isolate} setIsolate={setIsolate}/>
        : <Overview onSelect={(id) => choose(id, true)} setMode={setMode} setExplode={setExplode} setFlow={setFlow} onVR={enterVR} headset={xr}/>}
      <StructureList selected={selected} onSelect={(id) => choose(id, true)}/>
    </aside>
  </div>
}
