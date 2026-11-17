import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { StereoEffect } from 'three/addons/effects/StereoEffect.js'
import { buildHeart, updateHeart, disposeHeart, glowTexture } from './model.js'
import { createVRInterface, createReticle, deviceQuaternion, yawOf } from './vr.js'
import { PART_BY_ID } from './anatomy.js'

const HOME_TARGET = new THREE.Vector3(0.05, 0.2, 0)
const HOME_OFFSET = new THREE.Vector3(1, 0.85, 8.4)
const CUT_DEPTH = -0.02
const clamp = THREE.MathUtils.clamp
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

function backdrop() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const g = canvas.getContext('2d')
  const gradient = g.createRadialGradient(256, 220, 10, 256, 256, 400)
  gradient.addColorStop(0, '#22142e')
  gradient.addColorStop(0.45, '#0c1121')
  gradient.addColorStop(1, '#04060c')
  g.fillStyle = gradient
  g.fillRect(0, 0, 512, 512)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function decorations() {
  const group = new THREE.Group()
  const glow = glowTexture()
  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64),
    new THREE.MeshBasicMaterial({ map: glow, color: 0x2ee6c5, opacity: 0.16, ...additive }))
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.28, 1.3, 128),
    new THREE.MeshBasicMaterial({ color: 0x2ee6c5, opacity: 0.45, ...additive }))
  const arc = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.415, 96, 1, 0, Math.PI * 1.3),
    new THREE.MeshBasicMaterial({ color: 0xff5d7a, opacity: 0.45, ...additive }))
  for (const mesh of [disc, ring, arc]) {
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = -1.95
    group.add(mesh)
  }
  const count = 260
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 2.6 + Math.random() * 3.2, a = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 6
    positions.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3)
  }
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)),
    new THREE.PointsMaterial({ map: glow, color: 0x7fd8ff, size: 0.06, opacity: 0.5, ...additive }))
  group.add(dust)
  return { group, arc, dust, textures: [glow] }
}

export default function HeartScene({ beatRef, selected, onSelect, mode, explode, flow, labels, autoRotate, isolate, active, stereo,
  engineRef, onXRSupport, onVRAction, onVRChange }) {
  const host = useRef(null)
  const tooltip = useRef(null)
  const settings = useRef(null)
  const callbacks = useRef(null)
  const engine = useRef(null)
  const [failed] = useState(() => {
    try { return !document.createElement('canvas').getContext('webgl2') } catch { return true }
  })

  useEffect(() => {
    settings.current = { selected, mode, explode, flow, labels, autoRotate, isolate, active, stereo }
    callbacks.current = { onSelect, onXRSupport, onVRAction, onVRChange }
  })

  useEffect(() => {
    const element = host.current
    if (failed) return
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch {
      return
    }
    renderer.localClippingEnabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    renderer.xr.enabled = true
    renderer.domElement.className = 'block h-full w-full touch-none outline-none'
    element.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = backdrop()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.45
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60)
    scene.add(new THREE.HemisphereLight(0xffe4ea, 0x2a1830, 0.9))
    for (const [color, intensity, position] of [
      [0xffd6cc, 2.4, [3, 4, 5]], [0x7fb2ff, 2.2, [-4, 1, -4]], [0xff6b8a, 0.8, [-3, -2, 3]],
    ]) {
      const light = new THREE.DirectionalLight(color, intensity)
      light.position.set(...position)
      scene.add(light)
    }

    const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 6)
    const model = buildHeart({ cut })
    scene.add(model.root)
    const decor = decorations()
    scene.add(decor.group)

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.domElement.className = 'pointer-events-none absolute inset-0 overflow-hidden'
    element.append(labelRenderer.domElement)
    for (const part of Object.values(model.parts)) {
      part.label.element.addEventListener('click', (event) => {
        event.stopPropagation()
        callbacks.current.onSelect(part.id)
      })
    }

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 0.9)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 1.2
    controls.maxDistance = 11
    controls.autoRotateSpeed = 0.7
    controls.target.copy(HOME_TARGET)

    let tween = null
    const homePosition = () => HOME_TARGET.clone().addScaledVector(HOME_OFFSET, Math.max(1, 0.85 / camera.aspect))
    // OrbitControls keeps rotation momentum (notably from auto-rotate); flush it before moving the camera ourselves.
    const stopMomentum = () => {
      const { autoRotate, enableDamping } = controls
      controls.autoRotate = false
      controls.enableDamping = false
      controls.update()
      controls.autoRotate = autoRotate
      controls.enableDamping = enableDamping
    }
    const flyTo = (position, target, duration = 1.1) => {
      stopMomentum()
      tween = { from: camera.position.clone(), to: position, fromTarget: controls.target.clone(), toTarget: target, t: 0, duration }
    }
    controls.addEventListener('start', () => { tween = null })

    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight
      if (!width || !height) return
      const ratio = Math.min(window.devicePixelRatio, width < 700 ? 1.5 : 2)
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      composer.setPixelRatio(ratio)
      composer.setSize(width, height)
      labelRenderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    camera.position.copy(homePosition())

    // Picking -----------------------------------------------------------------
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    function hitPart(ray) {
      let fallback = null
      for (const hit of ray.intersectObjects(model.pickables, false)) {
        const part = model.parts[hit.object.userData.partId]
        if (!part || part.opacity < 0.04) continue
        if (part.clipped && cut.distanceToPoint(hit.point) < 0) continue
        if (part.opacity > 0.5) return { id: part.id, distance: hit.distance }
        fallback ??= { id: part.id, distance: hit.distance }
      }
      return fallback
    }
    function pick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return hitPart(raycaster)?.id ?? null
    }

    // VR: in-scene panel + menu, controllers (headset) and gaze reticle (phone viewer)
    const vrUI = createVRInterface()
    scene.add(vrUI.group)
    const reticle = createReticle()
    camera.add(reticle.object)
    scene.add(camera)
    const stereoEffect = new StereoEffect(renderer)
    stereoEffect.setEyeSeparation(0.18)
    // Mirrors the StereoEffect's eye cameras so a tap can be traced through the eye it landed in.
    const eyes = new THREE.StereoCamera()
    eyes.aspect = 0.5
    eyes.eyeSep = 0.18
    const spin = new THREE.Euler()
    const noSpin = new THREE.Euler()
    let grab = null
    let session = null
    let xrFloor = true

    function rayTarget(ray) {
      const button = vrUI.group.visible ? ray.intersectObjects(vrUI.targets, false)[0] : null
      const part = hitPart(ray)
      if (button && (!part || button.distance < part.distance)) {
        return { button: button.object, distance: button.distance, key: 'b:' + button.object.userData.action }
      }
      return part ? { part: part.id, distance: part.distance, key: 'p:' + part.id } : null
    }
    function runAction(action) {
      if (action === 'exit' && session) { session.end().catch(() => {}); return }
      if (action === 'reset') spin.set(0, 0, 0)
      callbacks.current.onVRAction?.(action)
    }
    function activate(target, clearOnEmpty) {
      if (target?.button) runAction(target.button.userData.action)
      else if (target?.part) callbacks.current.onSelect(target.part)
      else if (clearOnEmpty) callbacks.current.onSelect(null)
    }
    // Phone viewer taps: the centre divider (where a viewer's trigger lever touches) acts on the
    // reticle; anywhere else selects exactly the button or structure tapped in that eye.
    function tapStereo(event) {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const half = rect.width / 2
      if (Math.abs(x - half) < rect.width * 0.06) {
        activate(gaze.target, false)
        return
      }
      const left = x < half
      camera.updateMatrixWorld()
      eyes.update(camera)
      const eye = left ? eyes.cameraL : eyes.cameraR
      eye.updateMatrixWorld()
      eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert()
      ndc.set(((x - (left ? 0 : half)) / half) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, eye)
      activate(rayTarget(raycaster), false)
    }

    const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)])
    const dotGeometry = new THREE.SphereGeometry(0.008, 12, 8)
    const controllers = [0, 1].map((index) => {
      const controller = renderer.xr.getController(index)
      const ray = new THREE.Line(rayGeometry, new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.85 }))
      const dot = new THREE.Mesh(dotGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }))
      controller.add(ray, dot)
      const state = { controller, ray, dot, target: null }
      controller.addEventListener('selectstart', () => activate(state.target, true))
      controller.addEventListener('squeezestart', () => {
        grab = { controller, x: controller.position.x, y: controller.position.y, yaw: spin.y, pitch: spin.x }
      })
      controller.addEventListener('squeezeend', () => { if (grab?.controller === controller) grab = null })
      scene.add(controller)
      return state
    })

    const gaze = { key: null, time: 0, fired: false, target: null }
    let orientation = null
    let gyroAlign = null
    const deviceQ = new THREE.Quaternion()
    const onOrientation = (event) => { if (event.alpha !== null) orientation = event }
    window.addEventListener('deviceorientation', onOrientation)

    let hovered = null
    let pointer = null
    let down = null
    const canvas = renderer.domElement
    const onDown = (event) => { down = { x: event.clientX, y: event.clientY, time: performance.now() } }
    const onUp = (event) => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6 && performance.now() - down.time < 700) {
        if (settings.current?.stereo) tapStereo(event)
        else callbacks.current.onSelect(pick(event.clientX, event.clientY))
      }
      down = null
    }
    const onMove = (event) => { pointer = event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null }
    const onLeave = () => { pointer = null }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    // Engine API ----------------------------------------------------------------
    let alive = true
    engine.current = {
      focus(id) {
        const part = model.parts[id]
        // In VR the viewer's head controls the camera, so there is no fly-to.
        if (!part || renderer.xr.isPresenting || settings.current?.stereo) return
        model.root.updateMatrixWorld(true)
        const center = part.pivot.getWorldPosition(new THREE.Vector3())
        const vertical = THREE.MathUtils.degToRad(camera.fov / 2)
        const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
        const distance = clamp(part.radius * model.root.scale.x / Math.sin(Math.min(vertical, horizontal)) * 1.5, 2.1, 9)
        flyTo(center.clone().addScaledVector(new THREE.Vector3(...PART_BY_ID[id].view).normalize(), distance), center)
      },
      reset() { flyTo(homePosition(), HOME_TARGET.clone()) },
      async enterVR() {
        if (session) return
        try {
          session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] })
          if (!alive) { await session.end(); return }
          session.addEventListener('end', () => {
            session = null
            grab = null
            spin.set(0, 0, 0)
            if (alive) callbacks.current.onVRChange?.(null)
          }, { once: true })
          xrFloor = session.enabledFeatures ? session.enabledFeatures.includes('local-floor') : true
          renderer.xr.setReferenceSpaceType(xrFloor ? 'local-floor' : 'local')
          await renderer.xr.setSession(session)
          callbacks.current.onVRChange?.('headset')
        } catch {
          await session?.end().catch(() => {})
          session = null
          callbacks.current.onVRChange?.(null)
        }
      },
    }
    if (engineRef) engineRef.current = engine.current
    navigator.xr?.isSessionSupported('immersive-vr')
      .then((supported) => { if (alive) callbacks.current.onXRSupport?.(supported) }).catch(() => {})

    // Loop ----------------------------------------------------------------------
    const timer = new THREE.Timer()
    const origin = Date.now()
    let wasStereo = false
    renderer.setAnimationLoop((timestamp) => {
      timer.update(timestamp)
      const s = settings.current
      const dt = Math.min(timer.getDelta(), 0.05)
      const xr = renderer.xr.isPresenting
      if (!s || (!s.active && !xr) || !element.clientWidth) return

      const now = Date.now()
      const beat = beatRef.current
      // bpm 0 from the sensor means no pulse: hold the heart still in diastole.
      const stopped = beat?.bpm === 0
      const rr = stopped ? 2000 : clamp(60000 / (beat?.bpm || 72), 300, 2000)
      const lastR = beat?.lastBeat && now - beat.lastBeat < 3000 ? beat.lastBeat : origin
      const cutTarget = s.mode === 'cutaway' ? CUT_DEPTH : 3
      cut.constant += (cutTarget - cut.constant) * (1 - Math.exp(-dt * 4))

      const stereo = Boolean(s.stereo) && !xr
      if (stereo !== wasStereo) {
        wasStereo = stereo
        tween = null
        gyroAlign = null
        gaze.key = null
        reticle.object.visible = stereo
        controls.enabled = true
        stopMomentum()
        controls.target.copy(HOME_TARGET)
        // Phone viewers have a wide field of view; use one so the menu and panel fit in view.
        camera.fov = stereo ? 70 : 36
        camera.updateProjectionMatrix()
        camera.position.copy(stereo ? HOME_TARGET.clone().addScaledVector(HOME_OFFSET, 0.62) : homePosition())
        if (tooltip.current) tooltip.current.style.opacity = '0'
      }

      let uiHover = null
      if (xr) {
        hovered = null
        for (const state of controllers) {
          state.target = null
          if (state.controller.visible) {
            raycaster.setFromXRController(state.controller)
            state.target = rayTarget(raycaster)
            if (state.target?.part) hovered = state.target.part
            if (state.target?.button) uiHover = state.target.button
          }
          const length = state.target?.distance ?? 3
          state.ray.scale.z = length
          state.dot.position.set(0, 0, -length)
        }
        if (grab) {
          spin.y = grab.yaw + (grab.controller.position.x - grab.x) * 5
          spin.x = clamp(grab.pitch - (grab.controller.position.y - grab.y) * 5, -1.2, 1.2)
        }
      } else if (stereo) {
        if (orientation) {
          deviceQuaternion(orientation, deviceQ)
          if (!gyroAlign) {
            camera.lookAt(controls.target)
            gyroAlign = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawOf(camera.quaternion) - yawOf(deviceQ))
          }
          camera.quaternion.copy(gyroAlign).multiply(deviceQ)
          controls.enabled = false
        }
        camera.updateMatrixWorld()
        raycaster.setFromCamera(ndc.set(0, 0), camera)
        const seen = rayTarget(raycaster)
        // Tolerate brief flicker between neighbouring parts (the heart is beating) before restarting the dwell.
        if ((seen?.key ?? null) === gaze.key) {
          gaze.away = 0
          gaze.target = seen
          if (seen) gaze.time += dt
        } else if ((gaze.away = (gaze.away ?? 0) + dt) > 0.35 || !gaze.key) {
          gaze.key = seen?.key ?? null
          gaze.target = seen
          gaze.time = 0
          gaze.away = 0
          gaze.fired = false
        }
        const target = gaze.target
        const progress = target ? Math.min(1, gaze.time / 1.5) : 0
        if (progress >= 1 && !gaze.fired) {
          gaze.fired = true
          activate(target, false)
        }
        reticle.set(gaze.fired ? 0 : progress, Boolean(target))
        hovered = target?.part ?? null
        uiHover = target?.button ?? null
      } else if (pointer && !down) {
        const id = pick(pointer.x, pointer.y)
        hovered = id
        canvas.style.cursor = id ? 'pointer' : 'grab'
        const tip = tooltip.current
        if (tip) {
          const rect = element.getBoundingClientRect()
          tip.textContent = id ? PART_BY_ID[id].name : ''
          tip.style.opacity = id ? '1' : '0'
          tip.style.transform = `translate(${pointer.x - rect.left + 14}px, ${pointer.y - rect.top + 14}px)`
        }
      } else if (hovered) {
        hovered = null
        if (tooltip.current) tooltip.current.style.opacity = '0'
      }

      if (xr) {
        model.root.position.set(0, xrFloor ? 1.2 : -0.15, -1.65)
        model.baseScale = 0.36
      } else {
        model.root.position.set(0, 0, 0)
        model.baseScale = 1
      }
      model.root.rotation.copy(xr ? spin : noSpin)
      updateHeart(model, {
        dt, time: timer.getElapsed(), tR: stopped ? 1500 : ((now - lastR) % rr + rr) % rr, rr, stopped, blockage: beat?.blockage ?? 0, markers: !xr && !stereo, rate: beat?.bpm || 72,
        selected: s.selected, hovered, mode: s.mode, explode: s.explode,
        flow: s.flow, isolate: s.isolate, labels: s.labels && !xr && !stereo,
      })
      vrUI.update({
        kind: xr ? 'headset' : stereo ? 'stereo' : null, root: model.root, baseScale: model.baseScale,
        camera: xr ? renderer.xr.getCamera() : camera, selected: s.selected, bpm: beat?.bpm ?? null,
        mode: s.mode, explode: s.explode, flow: s.flow, isolate: s.isolate, hovered: uiHover,
      })
      decor.arc.rotation.z += dt * 0.25
      decor.dust.rotation.y += dt * 0.02
      decor.group.visible = !xr

      if (tween) {
        tween.t = Math.min(1, tween.t + dt / tween.duration)
        const e = ease(tween.t)
        camera.position.lerpVectors(tween.from, tween.to, e)
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e)
        if (tween.t >= 1) tween = null
      }
      if (xr) {
        renderer.render(scene, camera)
      } else if (stereo) {
        if (controls.enabled) {
          controls.autoRotate = false
          controls.update(dt)
        }
        stereoEffect.render(scene, camera)
        renderer.setViewport(0, 0, element.clientWidth, element.clientHeight)
      } else {
        controls.autoRotate = s.autoRotate && !tween && !down
        controls.update(dt)
        composer.render(dt)
        labelRenderer.render(scene, camera)
      }
    })

    return () => {
      alive = false
      renderer.setAnimationLoop(null)
      session?.end().catch(() => {})
      observer.disconnect()
      controls.dispose()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('deviceorientation', onOrientation)
      vrUI.dispose()
      reticle.dispose()
      rayGeometry.dispose()
      dotGeometry.dispose()
      controllers.forEach(({ ray, dot }) => { ray.material.dispose(); dot.material.dispose() })
      disposeHeart(model)
      decor.group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose() })
      decor.textures.forEach((texture) => texture.dispose())
      scene.background.dispose()
      scene.environment.dispose()
      pmrem.dispose()
      bloom.dispose()
      composer.dispose()
      renderer.dispose()
      canvas.remove()
      labelRenderer.domElement.remove()
      engine.current = null
      if (engineRef) engineRef.current = null
    }
  }, [beatRef, engineRef, failed])

  useEffect(() => {
    if (selected) engine.current?.focus(selected)
  }, [selected])

  return <div ref={host} className="absolute inset-0" aria-label="Interactive 3D heart. Drag to rotate, scroll or pinch to zoom, tap a structure to explore it.">
    {failed && <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
      3D rendering needs WebGL, which isn’t available in this browser.
    </div>}
    <div ref={tooltip} className="pointer-events-none absolute top-0 left-0 z-10 rounded-lg border border-white/10 bg-slate-950/85 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-xl backdrop-blur transition-opacity"/>
  </div>
}
