export const SAMPLE_MS = 10
export const FRAME_MS = 50
export const WINDOW = 600
export const HISTORY_KEY = 'cardiotwin.sim.history.v1'
export const TARGET = { baseline: 76, slow: 48, fast: 125 }
export const INITIAL = { samples: [], bpm: null, latest: null, beats: 0, lastBeat: null, lag: null, timestamp: null }

export const formatTime = (value) => value == null ? '—' : new Date(value).toLocaleTimeString()
const gaussian = (x, center, width) => Math.exp(-(((x - center) / width) ** 2))

function syntheticSample(phase, seconds) {
  return 0.12 * gaussian(phase, 0.17, 0.047)
    - 0.16 * gaussian(phase, 0.31, 0.02)
    + 1.05 * gaussian(phase, 0.35, 0.022)
    - 0.23 * gaussian(phase, 0.39, 0.027)
    + 0.27 * gaussian(phase, 0.64, 0.09)
    + 0.025 * Math.sin(seconds * 1.7)
    + (Math.random() - 0.5) * 0.042
}

// Data adapter. getRate() may return a live BPM (e.g. from Firebase) to pace the waveform;
// when it returns null the demo profile's target rate is used.
export function subscribeToDemo(profile, publish, getRate = () => null) {
  const pace = () => {
    const live = getRate()
    return live ? Math.min(220, Math.max(30, live)) : TARGET[profile] + (Math.random() - 0.5) * 5
  }
  let tick = performance.now()
  let sampleTime = tick
  let phase = 0
  let rate = pace()
  let lastR = null
  let lastBeat = null
  let bpm = null
  let beats = 0
  let samples = []
  const timer = setInterval(() => {
    const now = performance.now()
    const lag = Math.max(0, now - tick - FRAME_MS)
    tick = now
    // After a background-tab stall, start a fresh strip without backfilling beats.
    if (now - sampleTime > 500) {
      sampleTime = now
      samples = []
      phase = 0
      lastR = null
      lastBeat = null
      bpm = null
    }
    while (sampleTime + SAMPLE_MS <= now) {
      sampleTime += SAMPLE_MS
      const previous = phase
      phase += SAMPLE_MS * rate / 60000
      if (phase >= 1) {
        phase -= 1
        rate = pace()
      }
      if (previous < 0.35 && phase >= 0.35) {
        if (lastR !== null) bpm = Math.round(60000 / (sampleTime - lastR))
        lastR = sampleTime
        lastBeat = Date.now() - Math.round(now - sampleTime)
        beats += 1
      }
      samples.push(syntheticSample(phase, sampleTime / 1000))
    }
    samples = samples.slice(-WINDOW)
    publish({ samples, bpm, latest: samples.at(-1) ?? null, beats, lastBeat,
      lag: Math.round(lag), timestamp: Date.now() })
  }, FRAME_MS)
  return () => clearInterval(timer)
}

export function readHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(data) ? data.filter((row) =>
      Number.isFinite(row.timestamp) && Number.isFinite(row.bpm) &&
      Array.isArray(row.samples) && row.samples.every(Number.isFinite)
    ).slice(0, 36) : []
  } catch { return [] }
}
