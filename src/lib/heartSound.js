// Heartbeat sound ("lub-dub"), synthesised once into audio buffers — no audio files.
// The thumps include harmonics from ~150–400 Hz so they are audible on laptop and phone speakers.
// Browsers only allow audio after a user gesture, so call enableSound() from a click handler.

let ctx = null
let output = null
let lub = null
let dub = null

// Render one heart sound: a pitch-dropping thump with harmonics plus a short soft "click" of noise.
export function renderThump(sampleRate, freq, duration, seed = 1) {
  const length = Math.round(sampleRate * duration)
  const data = new Float32Array(length)
  let phase = 0
  let noise = 0
  let s = seed
  let peak = 0
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const envelope = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / (duration * 0.28))
    phase += 2 * Math.PI * freq * (1 + 0.6 * Math.exp(-t / 0.02)) / sampleRate
    s = (s * 1664525 + 1013904223) >>> 0
    noise += ((s / 4294967296) * 2 - 1 - noise) * 0.2
    const value = (Math.sin(phase) + 0.6 * Math.sin(2 * phase) + 0.35 * Math.sin(3 * phase)) * envelope +
      1.4 * noise * Math.exp(-t / 0.012)
    data[i] = value
    peak = Math.max(peak, Math.abs(value))
  }
  for (let i = 0; i < length; i++) data[i] *= 0.95 / peak
  return data
}

function toBuffer(samples) {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
  buffer.copyToChannel(samples, 0)
  return buffer
}

export function enableSound() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return Promise.resolve(false)
    ctx = new AudioContext()
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 4
    output = ctx.createGain()
    output.gain.value = 1
    output.connect(compressor).connect(ctx.destination)
    lub = toBuffer(renderThump(ctx.sampleRate, 92, 0.18, 7))
    dub = toBuffer(renderThump(ctx.sampleRate, 124, 0.12, 13))
  }
  return ctx.resume().then(() => {
    // Play one beat straight away so the user hears that sound is on.
    playHeartbeat(72)
    return true
  }, () => false)
}

function play(buffer, at, level) {
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  source.buffer = buffer
  gain.gain.value = level
  source.connect(gain).connect(output)
  source.start(at)
}

// "Lub-dub": S1 (AV valves close) then S2 (semilunar valves close). The gap shortens at faster rates.
export function playHeartbeat(bpm) {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime + 0.01
  const gap = Math.min(0.32, Math.max(0.15, 0.36 * 60 / Math.max(bpm || 72, 30)))
  play(lub, now, 1)
  play(dub, now + gap, 0.7)
}
