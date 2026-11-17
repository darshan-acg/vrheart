import { initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyAr4IYnykpwovqOJWzfBd7abVdAma_Ig3Q',
  authDomain: 'diet-planner-3bdf3.firebaseapp.com',
  databaseURL: 'https://diet-planner-3bdf3-default-rtdb.firebaseio.com',
  projectId: 'diet-planner-3bdf3',
  storageBucket: 'diet-planner-3bdf3.firebasestorage.app',
  messagingSenderId: '927878354911',
  appId: '1:927878354911:web:2e616b171a267b9910566a',
}

// Database node written by the sensor device: { bpm, ecg_value }
export const DEVICE_PATH = '5802'

const db = getDatabase(initializeApp(firebaseConfig))

// Calls publish({ bpm, ecgValue, receivedAt }) on every change, or onError(error) if the read fails.
export function subscribeToHeartRate(publish, onError) {
  return onValue(ref(db, DEVICE_PATH), (snapshot) => {
    const data = snapshot.val() ?? {}
    const bpm = Number(data.bpm)
    const ecgValue = Number(data.ecg_value)
    publish({
      // 0 is a real reading (no pulse detected); null means the field is missing.
      bpm: data.bpm != null && Number.isFinite(bpm) && bpm >= 0 ? Math.round(bpm) : null,
      ecgValue: Number.isFinite(ecgValue) ? ecgValue : null,
      receivedAt: Date.now(),
    })
  }, onError)
}
