// Rate-based condition assessment for the dashboard.
// Heart rate alone cannot diagnose a heart attack or a blocked artery. The `blockage` value only
// drives an illustrative coronary-blockage animation for abnormal states:
// 0 = clear artery, 0.5 = narrowed (plaque), 1 = fully blocked with starved muscle (heart attack illustration).

export const LEVEL_STYLE = {
  normal: { text: 'text-emerald-300', chip: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200', dot: 'bg-emerald-400' },
  warning: { text: 'text-amber-300', chip: 'border-amber-400/25 bg-amber-400/10 text-amber-200', dot: 'bg-amber-400' },
  critical: { text: 'text-rose-300', chip: 'border-rose-400/30 bg-rose-500/15 text-rose-200', dot: 'bg-rose-500' },
}

export function assessHeartRate(bpm, { low = 55, high = 105 } = {}) {
  if (bpm === null || bpm === undefined) return null
  const severeLow = Math.min(40, low)
  const severeHigh = Math.max(150, high)

  if (bpm === 0) return {
    id: 'no-pulse', level: 'critical', blockage: 1,
    title: 'No pulse detected',
    summary: 'Possible cardiac arrest, or the sensor is not reading. Check the sensor contact first.',
    advice: 'If a person is unresponsive and not breathing normally, call emergency services and start CPR.',
    animation: 'Shows a fully blocked coronary artery (heart attack) — the most common cause of cardiac arrest. The heart is stopped.',
  }
  if (bpm < severeLow) return {
    id: 'severe-bradycardia', level: 'critical', blockage: 1,
    title: 'Severe bradycardia',
    summary: `Very slow heart rate (below ${severeLow} BPM). Can be caused by heart block, which may follow a heart attack.`,
    advice: 'Dizziness, fainting or chest pain with a rate this low needs urgent medical attention.',
    animation: 'Shows a fully blocked coronary artery and starved heart muscle (heart attack illustration).',
  }
  if (bpm < low) return {
    id: 'bradycardia', level: 'warning', blockage: 0.5,
    title: 'Bradycardia (slow heart rate)',
    summary: `Below your low limit of ${low} BPM. Normal for athletes and during sleep; otherwise watch for tiredness or dizziness.`,
    advice: 'Recheck at rest. See a doctor if it stays low and you have symptoms.',
    animation: 'Shows a narrowed coronary artery (plaque build-up) with reduced blood flow.',
  }
  if (bpm > severeHigh) return {
    id: 'severe-tachycardia', level: 'critical', blockage: 1,
    title: 'Severe tachycardia',
    summary: `Very fast heart rate (above ${severeHigh} BPM). At rest this can occur with a heart attack or a dangerous arrhythmia.`,
    advice: 'With chest pain, breathlessness or fainting, call emergency services.',
    animation: 'Shows a fully blocked coronary artery and starved heart muscle (heart attack illustration).',
  }
  if (bpm > high) return {
    id: 'tachycardia', level: 'warning', blockage: 0.5,
    title: 'Tachycardia (fast heart rate)',
    summary: `Above your high limit of ${high} BPM. Common with exercise, stress, fever or caffeine; at rest it can mean the heart is under strain.`,
    advice: 'Rest and recheck. See a doctor if it stays high at rest.',
    animation: 'Shows a narrowed coronary artery (plaque build-up) — a strained heart needs more blood than it can get.',
  }
  return {
    id: 'normal', level: 'normal', blockage: 0,
    title: 'Normal heart rate',
    summary: `Within your range of ${low}–${high} BPM.`,
    advice: 'Keep it up.',
    animation: 'Coronary arteries are clear and blood flows normally.',
  }
}
