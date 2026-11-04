import * as THREE from 'three'
import { CATEGORIES, PART_BY_ID } from './anatomy.js'

// In-scene UI for VR: an info panel, a button menu, a gaze reticle and gyro look-around.
// Layouts are in heart units; the UI group copies the heart's position and scale.

const CATEGORY = Object.fromEntries(CATEGORIES.map((category) => [category.id, category]))
const FONT = '"Inter", "Segoe UI", system-ui, sans-serif'

export const VR_BUTTONS = [
  ['exterior', 'Exterior'], ['xray', 'X-ray'], ['cutaway', 'Cutaway'], ['separate', 'Separate'],
  ['flow', 'Blood flow'], ['isolate', 'Isolate'], ['reset', 'Reset'], ['exit', 'Exit VR'],
]

const LAYOUT = {
  headset: { panel: [3, 0.6, 0.8], menu: [0, -0.75, 2.2] },
  stereo: { panel: [3.2, 0.5, 0.5], menu: [0, -2.7, 1.5] },
}

function canvasTexture(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { canvas, g: canvas.getContext('2d'), texture }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

function wrap(g, text, x, y, width, lineHeight, maxLines) {
  const words = text.split(' ')
  let line = ''
  let lines = 0
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i]
    if (g.measureText(next).width > width && line) {
      if (lines === maxLines - 1) { g.fillText(line + '…', x, y); return y + lineHeight }
      g.fillText(line, x, y)
      line = words[i]
      y += lineHeight
      lines++
    } else {
      line = next
    }
  }
  if (line) g.fillText(line, x, y)
  return y + lineHeight
}

function flatMaterial(texture) {
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false })
}

function drawPanel(g, { part, bpm, kind }) {
  const W = 1024, H = 640
  g.clearRect(0, 0, W, H)
  roundRect(g, 4, 4, W - 8, H - 8, 44)
  g.fillStyle = 'rgba(7, 10, 20, 0.9)'
  g.fill()
  g.lineWidth = 3
  g.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  g.stroke()

  g.textBaseline = 'top'
  g.font = `600 30px ${FONT}`
  g.fillStyle = '#fb7185'
  g.textAlign = 'right'
  g.fillText(`♥ ${bpm ?? '—'} BPM`, W - 56, 52)
  g.textAlign = 'left'

  if (!part) {
    g.fillStyle = '#94a3b8'
    g.font = `600 26px ${FONT}`
    g.fillText('CARDIOTWIN VR', 56, 54)
    g.fillStyle = '#ffffff'
    g.font = `700 64px ${FONT}`
    g.fillText('Explore the heart', 56, 110)
    g.fillStyle = '#cbd5e1'
    g.font = `400 32px ${FONT}`
    const help = kind === 'headset'
      ? 'Point a controller at any structure and pull the trigger to select it. Squeeze the grip and move your hand to rotate the heart. Use the menu below for views.'
      : 'Look at any structure for a moment — or tap the screen — to select it. Look down at the menu to change views or exit.'
    wrap(g, help, 56, 210, W - 112, 46, 6)
    return
  }

  const category = CATEGORY[part.category]
  g.fillStyle = category.color
  g.beginPath()
  g.arc(68, 68, 10, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#94a3b8'
  g.font = `600 26px ${FONT}`
  g.fillText(category.name.toUpperCase(), 90, 54)
  g.fillStyle = '#ffffff'
  g.font = `700 60px ${FONT}`
  g.fillText(part.name, 56, 104)
  g.fillStyle = '#cbd5e1'
  g.font = `400 30px ${FONT}`
  let y = wrap(g, part.summary, 56, 186, W - 112, 40, 2)

  const boxW = (W - 112 - 32) / 3
  y += 14
  part.facts.forEach(([term, value], i) => {
    const x = 56 + i * (boxW + 16)
    roundRect(g, x, y, boxW, 116, 24)
    g.fillStyle = 'rgba(255, 255, 255, 0.05)'
    g.fill()
    g.fillStyle = '#64748b'
    g.font = `600 20px ${FONT}`
    g.fillText(term.toUpperCase(), x + 22, y + 20)
    g.fillStyle = '#f8fafc'
    g.font = `600 30px ${FONT}`
    wrap(g, value, x + 22, y + 52, boxW - 44, 34, 2)
  })
  y += 146
  roundRect(g, 56, y, W - 112, H - y - 44, 24)
  g.fillStyle = 'rgba(252, 211, 77, 0.08)'
  g.fill()
  g.fillStyle = '#fde68a'
  g.font = `400 28px ${FONT}`
  wrap(g, '⚡ ' + part.animation, 80, y + 22, W - 160, 38, 2)
}

function drawButton(g, label, active, hovered) {
  const W = 320, H = 124
  g.clearRect(0, 0, W, H)
  roundRect(g, 4, 4, W - 8, H - 8, 34)
  g.fillStyle = active ? 'rgba(244, 63, 94, 0.85)' : hovered ? 'rgba(51, 65, 85, 0.95)' : 'rgba(7, 10, 20, 0.88)'
  g.fill()
  g.lineWidth = hovered ? 6 : 3
  g.strokeStyle = hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.18)'
  g.stroke()
  g.fillStyle = '#ffffff'
  g.font = `600 40px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, W / 2, H / 2 + 2)
}

export function createVRInterface() {
  const group = new THREE.Group()
  group.visible = false

  const panelCanvas = canvasTexture(1024, 640)
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.375), flatMaterial(panelCanvas.texture))
  panel.renderOrder = 30
  group.add(panel)

  const menu = new THREE.Group()
  group.add(menu)
  const buttons = VR_BUTTONS.map(([action, label], i) => {
    const art = canvasTexture(320, 124)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), flatMaterial(art.texture))
    mesh.position.set(((i % 4) - 1.5) * 0.7, i < 4 ? 0.15 : -0.15, 0)
    mesh.renderOrder = 31
    mesh.userData.action = action
    menu.add(mesh)
    return { mesh, art, label, key: '' }
  })

  let panelKey = ''
  const look = new THREE.Vector3()

  return {
    group,
    targets: buttons.map(({ mesh }) => mesh),
    update({ kind, root, baseScale, camera, selected, bpm, mode, explode, flow, isolate, hovered }) {
      group.visible = Boolean(kind)
      if (!kind) return
      group.position.copy(root.position)
      group.scale.setScalar(baseScale)
      const layout = LAYOUT[kind]
      panel.position.set(...layout.panel)
      menu.position.set(...layout.menu)
      camera.getWorldPosition(look)
      panel.lookAt(look)
      menu.lookAt(look)

      const key = `${kind}|${selected}|${bpm}`
      if (key !== panelKey) {
        panelKey = key
        drawPanel(panelCanvas.g, { part: selected ? PART_BY_ID[selected] : null, bpm, kind })
        panelCanvas.texture.needsUpdate = true
      }
      for (const button of buttons) {
        const action = button.mesh.userData.action
        const active = action === mode || (action === 'separate' && explode > 0.5) ||
          (action === 'flow' && flow) || (action === 'isolate' && isolate)
        const isHovered = hovered === button.mesh
        const state = `${active}|${isHovered}`
        if (state !== button.key) {
          button.key = state
          drawButton(button.art.g, button.label, active, isHovered)
          button.art.texture.needsUpdate = true
        }
      }
    },
    dispose() {
      group.traverse((object) => {
        object.geometry?.dispose()
        object.material?.map?.dispose()
        object.material?.dispose()
      })
    },
  }
}

// Centre-of-view reticle for gaze selection; the inner disc fills while dwelling.
export function createReticle() {
  const reticle = new THREE.Group()
  const material = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false,
  })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.042, 40), material(0xffffff, 0.9))
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.03, 40), material(0xfb7185, 0.9))
  for (const mesh of [ring, fill]) {
    mesh.renderOrder = 1000
    reticle.add(mesh)
  }
  reticle.position.set(0, 0, -2)
  reticle.visible = false
  return {
    object: reticle,
    set(progress, active) {
      fill.scale.setScalar(Math.max(0.001, progress))
      ring.material.color.set(active ? 0xfb7185 : 0xffffff)
    },
    dispose() {
      reticle.traverse((object) => { object.geometry?.dispose(); object.material?.dispose() })
    },
  }
}

// Device orientation → camera quaternion (same maths as the classic DeviceOrientationControls).
const zee = new THREE.Vector3(0, 0, 1)
const euler = new THREE.Euler()
const q0 = new THREE.Quaternion()
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
const toRad = THREE.MathUtils.degToRad

export function deviceQuaternion(event, target) {
  const orient = toRad(screen.orientation?.angle ?? window.orientation ?? 0)
  euler.set(toRad(event.beta), toRad(event.alpha), -toRad(event.gamma), 'YXZ')
  return target.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient))
}

export function yawOf(quaternion) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion)
  return Math.atan2(-forward.x, -forward.z)
}
