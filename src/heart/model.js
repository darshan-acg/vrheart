import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { PART_BY_ID } from './anatomy.js'

// Procedural, illustrative heart. Coordinates are an anterior view:
// +x = patient's left (viewer's right), +y = up, +z = toward the viewer.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const UP = V(0, 1, 0)
const clamp = THREE.MathUtils.clamp
const smoothstep = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b)
const mod = (a, n) => ((a % n) + n) % n

function random(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function noise(x, y, z) {
  return Math.sin(x * 2.9 + Math.sin(y * 1.7)) * Math.cos(z * 2.3 + Math.sin(x * 1.3)) * 0.6
    + Math.sin(y * 4.7 + z * 3.1) * Math.cos(x * 3.9) * 0.3
    + Math.sin(x * 9.1 + y * 7.3 + z * 8.7) * 0.1
}

// ---------------------------------------------------------------- textures

function fibreTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  const rand = random(7)
  g.fillStyle = '#7f7f7f'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 1100; i++) {
    const x = rand() * size, y = rand() * size
    const length = 30 + rand() * 110
    const angle = -0.55 + (rand() - 0.5) * 0.35
    g.strokeStyle = rand() < 0.5 ? `rgba(255,255,255,${0.05 + rand() * 0.1})` : `rgba(0,0,0,${0.06 + rand() * 0.12})`
    g.lineWidth = 0.8 + rand() * 2.2
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.beginPath()
      g.moveTo(x + dx, y + dy)
      g.quadraticCurveTo(x + dx + Math.cos(angle) * length * 0.5 + 6, y + dy + Math.sin(angle) * length * 0.5 - 6,
        x + dx + Math.cos(angle) * length, y + dy + Math.sin(angle) * length)
      g.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 2)
  return texture
}

export function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const g = canvas.getContext('2d')
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.65)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gradient
  g.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// ---------------------------------------------------------------- geometry

// Copies normals from a welded clone so sphere seams don't show in the lighting.
function smoothNormals(geometry) {
  const copy = geometry.clone()
  copy.deleteAttribute('normal')
  copy.deleteAttribute('uv')
  const welded = mergeVertices(copy, 1e-4)
  welded.computeVertexNormals()
  const key = (a, i) => `${Math.round(a.getX(i) * 1e4)},${Math.round(a.getY(i) * 1e4)},${Math.round(a.getZ(i) * 1e4)}`
  const lookup = new Map()
  const wp = welded.attributes.position, wn = welded.attributes.normal
  for (let i = 0; i < wp.count; i++) lookup.set(key(wp, i), i)
  const p = geometry.attributes.position, n = geometry.attributes.normal
  for (let i = 0; i < p.count; i++) {
    const j = lookup.get(key(p, i))
    if (j !== undefined) n.setXYZ(i, wn.getX(j), wn.getY(j), wn.getZ(j))
  }
  copy.dispose()
  welded.dispose()
}

// Organic ellipsoid; `taper` narrows it toward -y to form an apex, `flat` squares off the top.
function blob({ radii, taper = 0, flat = 0, seed = 0, rough = 0.04, bend = 0 }) {
  const geometry = new THREE.SphereGeometry(1, 72, 48)
  const p = geometry.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const t = (1 - v.y) / 2
    const width = 1 - taper * t ** 1.8
    const y = v.y > 0 ? v.y * (1 - flat * v.y * v.y) : v.y
    const k = 1 + rough * noise(v.x * 1.6 + seed, v.y * 1.6 - seed * 0.7, v.z * 1.6 + seed * 0.3)
    p.setXYZ(i, v.x * width * radii[0] * k + bend * t * t, y * radii[1] * k, v.z * width * radii[2] * k)
  }
  geometry.computeVertexNormals()
  smoothNormals(geometry)
  return geometry
}

function tube(points, radius, { taper = 1, segments = 64, radial = 14 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => p.isVector3 ? p.clone() : V(...p)), false, 'centripetal')
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false)
  if (taper !== 1) {
    const pos = geometry.attributes.position
    const c = new THREE.Vector3(), v = new THREE.Vector3()
    for (let i = 0; i <= segments; i++) {
      curve.getPointAt(i / segments, c)
      const k = 1 + (taper - 1) * (i / segments)
      for (let j = 0; j <= radial; j++) {
        const index = i * (radial + 1) + j
        v.fromBufferAttribute(pos, index).sub(c).multiplyScalar(k).add(c)
        pos.setXYZ(index, v.x, v.y, v.z)
      }
    }
  }
  return { curve, geometry }
}

function wiggle(points, amount, seed) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(...p)))
  const out = []
  const side = new THREE.Vector3()
  for (let i = 0; i <= 40; i++) {
    const u = i / 40
    const point = curve.getPointAt(u)
    side.crossVectors(curve.getTangentAt(u), V(0, 0, 1)).normalize()
    const fade = Math.sin(Math.PI * u) * 0.7 + 0.3
    point.addScaledVector(side, amount * fade * Math.sin(i * 0.9 + seed))
    point.z += amount * 0.6 * fade * Math.cos(i * 1.3 + seed)
    out.push(point)
  }
  return out
}

function leafletGeometry(r, mid, half, hinge, belly) {
  const rows = 8, cols = 14
  const positions = [], indices = []
  for (let i = 0; i <= rows; i++) {
    const s = i / rows
    for (let j = 0; j <= cols; j++) {
      const a = mid - half + (2 * half * j) / cols
      const y = -r * belly * Math.sin(Math.PI * s) * Math.sin(Math.PI * j / cols)
      positions.push(Math.cos(a) * r * s - hinge.x, y, Math.sin(a) * r * s - hinge.z)
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1
    indices.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeSurface(targets) {
  const raycaster = new THREE.Raycaster()
  return (origin, direction) => {
    raycaster.set(origin, direction)
    const hit = raycaster.intersectObjects(targets, false)[0]
    if (!hit) return null
    return { point: hit.point.clone(), normal: hit.face.normal.clone().transformDirection(hit.object.matrixWorld) }
  }
}

// Samples a rough path and snaps every point onto the nearest outer surface.
function surfacePath(surface, center, points, lift) {
  const rough = new THREE.CatmullRomCurve3(points.map((p) => V(...p)))
  const snapped = rough.getSpacedPoints(26).map((p) => {
    const dir = p.clone().sub(center).normalize()
    const hit = surface(center.clone().addScaledVector(dir, 6), dir.clone().negate())
    return hit ? hit.point.addScaledVector(hit.normal, lift) : p
  })
  return snapped.map((p, i) => i === 0 || i === snapped.length - 1 ? p
    : p.clone().multiplyScalar(0.5).addScaledVector(snapped[i - 1], 0.25).addScaledVector(snapped[i + 1], 0.25))
}

// ---------------------------------------------------------------- materials

function tintBackfaces(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
    '#include <color_fragment>\n\tif (!gl_FrontFacing) diffuseColor.rgb *= vec3(0.72, 0.34, 0.38);')
}

function tissue(env, color, { clip = true, ...extra } = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.35,
    sheen: 0.3, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xff8090),
    bumpMap: env.fibre, bumpScale: 0.9, side: THREE.DoubleSide,
    clippingPlanes: clip ? [env.cut] : null, ...extra,
  })
  material.onBeforeCompile = tintBackfaces
  return material
}

const vessel = (env, color, extra) => tissue(env, color, { roughness: 0.36, bumpScale: 0.2, sheen: 0.2, clearcoat: 0.8, ...extra })

function glowing(color, intensity, extra = {}) {
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, ...extra })
  material.userData.conduction = true
  return material
}

// ---------------------------------------------------------------- parts

function createPart(root, id, kind, explode, flags = {}) {
  const group = new THREE.Group()
  const pivot = new THREE.Group()
  const inner = new THREE.Group()
  group.add(pivot)
  pivot.add(inner)
  root.add(group)
  const info = PART_BY_ID[id]
  return {
    id, kind, info, group, pivot, inner, explode: V(...explode),
    materials: new Set(), meshes: [], flows: [], leaflets: [], segments: [], halos: [],
    opacity: 1, highlight: 0, internal: Boolean(info.internal), xray: 1, clipped: false,
    timing: null, pulsatile: false, glow: new THREE.Color(info.color), ...flags,
  }
}

function track(part, material) {
  // Always transparent: three.js bakes "opaque" into the shader, so toggling later would not fade.
  material.transparent = true
  material.userData.baseOpacity = material.opacity
  material.userData.baseEmissive = material.emissive?.clone() ?? null
  material.userData.baseIntensity = material.emissiveIntensity ?? 1
  if (material.clippingPlanes?.length) part.clipped = true
  part.materials.add(material)
  return material
}

function addMesh(part, geometry, material, { position, rotation, quaternion, parent } = {}) {
  const mesh = new THREE.Mesh(geometry, track(part, material))
  if (position) mesh.position.set(...position)
  if (rotation) mesh.rotation.set(...rotation)
  if (quaternion) mesh.quaternion.copy(quaternion)
  mesh.userData.partId = part.id
  part.meshes.push(mesh)
  ;(parent ?? part.inner).add(mesh)
  return mesh
}

function cap(part, curve, atStart, radius, wall, lumen) {
  const point = curve.getPointAt(atStart ? 0 : 1)
  const tangent = curve.getTangentAt(atStart ? 0 : 1)
  if (atStart) tangent.negate()
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tangent)
  addMesh(part, new THREE.RingGeometry(radius * 0.7, radius, 32), wall, { position: point.toArray(), quaternion: q })
  addMesh(part, new THREE.CircleGeometry(radius * 0.7, 32), lumen, { position: point.toArray(), quaternion: q })
}

function addFlow(part, curve, radius, count) {
  part.flows.push({ curve, radius, count, length: curve.getLength(), phase: 0 })
}

function addValve(part, { center, normal, radius, cusps, kind, spin = 0 }) {
  const group = new THREE.Group()
  group.position.set(...center)
  group.quaternion.setFromUnitVectors(UP, normal.clone().normalize())
  group.rotateY(spin)
  part.inner.add(group)
  const ring = track(part, new THREE.MeshPhysicalMaterial({ color: 0xe3a796, roughness: 0.45, clearcoat: 0.4 }))
  addMesh(part, new THREE.TorusGeometry(radius, radius * 0.13, 12, 56), ring, { rotation: [Math.PI / 2, 0, 0], parent: group })
  const leaf = track(part, new THREE.MeshPhysicalMaterial({
    color: part.info.color, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide, emissive: 0x000000,
  }))
  const half = Math.PI / cusps - 0.035
  for (let k = 0; k < cusps; k++) {
    const mid = (k / cusps) * Math.PI * 2
    const hinge = V(Math.cos(mid), 0, Math.sin(mid)).multiplyScalar(radius * Math.cos(half) * 0.98)
    const pivot = new THREE.Group()
    pivot.position.copy(hinge)
    group.add(pivot)
    addMesh(part, leafletGeometry(radius * 0.96, mid, half, hinge, kind === 'semilunar' ? 0.22 : 0.12), leaf, { parent: pivot })
    part.leaflets.push({ pivot, axis: V(-Math.sin(mid), 0, Math.cos(mid)) })
  }
  part.valve = kind
  return group
}

function addSegment(part, env, curve, t0, t1, size = 0.13) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: env.glowMap, color: part.info.color, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, transparent: true,
  }))
  sprite.scale.setScalar(size)
  sprite.renderOrder = 20
  sprite.visible = false
  part.segments.push({ curve, t0, t1, sprite })
}

function addHalo(part, env, position, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: env.glowMap, color: part.info.color, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, transparent: true, opacity: 0,
  }))
  sprite.position.copy(position)
  sprite.renderOrder = 19
  part.halos.push({ sprite, size })
}

function axisOf(mesh) {
  return UP.clone().applyQuaternion(mesh.quaternion)
}

// ---------------------------------------------------------------- build

export function buildHeart({ cut }) {
  const root = new THREE.Group()
  const parts = {}
  const env = { cut, fibre: fibreTexture(), glowMap: glowTexture() }
  const make = (id, kind, explode, flags) => (parts[id] = createPart(root, id, kind, explode, flags))
  const lumen = () => new THREE.MeshStandardMaterial({ color: 0x3a0812, roughness: 0.8, side: THREE.DoubleSide, clippingPlanes: [cut] })

  // Chambers --------------------------------------------------------------
  const ra = make('right-atrium', 'atrium', [-1, 0.25, 0.25], { xray: 0.14 })
  const raMat = tissue(env, 0xa82d45)
  const raMesh = addMesh(ra, blob({ radii: [0.48, 0.52, 0.46], seed: 3.3, rough: 0.06 }), raMat, { position: [-0.72, 0.36, 0] })
  const raAuricle = addMesh(ra, blob({ radii: [0.27, 0.14, 0.2], seed: 5.1, rough: 0.14 }), raMat,
    { position: [-0.46, 0.64, 0.36], rotation: [0.4, 0.3, -0.5] })

  const la = make('left-atrium', 'atrium', [0.35, 0.45, -1], { xray: 0.14 })
  const laMat = tissue(env, 0xa3344a)
  const laMesh = addMesh(la, blob({ radii: [0.52, 0.38, 0.44], seed: 4.4, rough: 0.05 }), laMat, { position: [0.32, 0.42, -0.56] })
  const laAuricle = addMesh(la, blob({ radii: [0.25, 0.12, 0.17], seed: 6.2, rough: 0.14 }), laMat,
    { position: [0.74, 0.5, -0.1], rotation: [0.2, -0.6, 0.6] })

  const rv = make('right-ventricle', 'ventricle', [-0.55, -0.35, 1], { xray: 0.14 })
  const rvMat = tissue(env, 0x9a2640)
  const rvMesh = addMesh(rv, blob({ radii: [0.58, 0.82, 0.42], taper: 0.6, flat: 0.3, seed: 2.1 }), rvMat,
    { position: [-0.16, -0.36, 0.3], rotation: [-0.12, 0, 0.3] })
  const rvOutflow = addMesh(rv, blob({ radii: [0.24, 0.4, 0.22], seed: 6, rough: 0.03 }), rvMat,
    { position: [0, 0.1, 0.4], rotation: [0.15, 0, -0.25] })

  const lv = make('left-ventricle', 'ventricle', [0.9, -0.55, -0.35], { xray: 0.14 })
  const lvMesh = addMesh(lv, blob({ radii: [0.66, 1.05, 0.64], taper: 0.78, flat: 0.35, seed: 1.3, bend: 0.05 }),
    tissue(env, 0x8c1f36), { position: [0.3, -0.45, -0.12], rotation: [-0.22, 0, 0.45] })

  root.updateMatrixWorld(true)

  // Septum ------------------------------------------------------------------
  const septum = make('septum', 'ventricle', [0, 0, 0], { xray: 0.85 })
  const sepNormal = lvMesh.position.clone().sub(rvMesh.position).normalize()
  const lvAxis = axisOf(lvMesh)
  const sepY = lvAxis.clone().addScaledVector(sepNormal, -lvAxis.dot(sepNormal)).normalize()
  const sepX = new THREE.Vector3().crossVectors(sepY, sepNormal)
  addMesh(septum, blob({ radii: [0.42, 0.78, 0.07], taper: 0.65, seed: 8, rough: 0.05 }), tissue(env, 0x7d1f35, { clip: false }), {
    position: [0.06, -0.38, 0.1],
    quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(sepX, sepY, sepNormal)),
  })

  // Great vessels -----------------------------------------------------------
  const aorta = make('aorta', 'vessel', [-0.1, 1, -0.3], { xray: 0.22, pulsatile: true })
  const aortaMat = vessel(env, 0xc0303f)
  const aortaWall = vessel(env, 0x9e2434)
  const aortaLumen = lumen()
  const aortaPath = tube([[0.12, 0.33, -0.05], [-0.02, 0.85, 0.05], [-0.05, 1.3, -0.05], [0.2, 1.56, -0.3],
    [0.55, 1.45, -0.6], [0.65, 1, -1], [0.65, 0.2, -1.2], [0.58, -1, -1.2]], 0.16, { segments: 180, radial: 24 })
  addMesh(aorta, aortaPath.geometry, aortaMat)
  cap(aorta, aortaPath.curve, false, 0.16, aortaWall, aortaLumen)
  addFlow(aorta, aortaPath.curve, 0.16, 80)
  let archTop = 0.3
  for (let u = 0.2, best = -Infinity; u < 0.6; u += 0.005) {
    const y = aortaPath.curve.getPointAt(u).y
    if (y > best) { best = y; archTop = u }
  }
  for (const [du, dx, height] of [[-0.065, -0.2, 0.6], [0, 0.02, 0.56], [0.065, 0.22, 0.5]]) {
    const start = aortaPath.curve.getPointAt(archTop + du)
    const branch = tube([start, start.clone().add(V(dx * 0.4, height * 0.5, 0.01)), start.clone().add(V(dx, height, 0.03))], 0.065, { radial: 14 })
    addMesh(aorta, branch.geometry, aortaMat)
    cap(aorta, branch.curve, false, 0.065, aortaWall, aortaLumen)
    addFlow(aorta, branch.curve, 0.065, 14)
  }

  const pa = make('pulmonary-artery', 'vessel', [0.45, 0.9, 0.55], { xray: 0.22, pulsatile: true })
  const paMat = vessel(env, 0x3e55c4)
  const paWall = vessel(env, 0x30449f)
  const paLumen = lumen()
  const trunk = tube([[0.02, 0.42, 0.4], [0.08, 0.8, 0.42], [0.25, 1.03, 0.28], [0.36, 1.09, 0.1]], 0.155, { radial: 22 })
  addMesh(pa, trunk.geometry, paMat)
  addMesh(pa, new THREE.SphereGeometry(0.15, 24, 16), paMat, { position: [0.36, 1.09, 0.1] })
  addFlow(pa, trunk.curve, 0.155, 30)
  for (const points of [
    [[0.36, 1.09, 0.1], [0.62, 1.1, -0.08], [0.85, 1.05, -0.3], [1.08, 0.95, -0.5]],
    [[0.36, 1.09, 0.1], [0.12, 0.98, -0.3], [-0.4, 0.95, -0.48], [-0.98, 0.9, -0.52]],
  ]) {
    const branch = tube(points, 0.12, { radial: 18 })
    addMesh(pa, branch.geometry, paMat)
    cap(pa, branch.curve, false, 0.12, paWall, paLumen)
    addFlow(pa, branch.curve, 0.12, 24)
  }

  const svc = make('superior-vena-cava', 'vessel', [-1, 0.9, 0], { xray: 0.22 })
  const svcMat = vessel(env, 0x3a4db0)
  const svcPath = tube([[-0.62, 1.68, -0.12], [-0.64, 1.15, -0.08], [-0.7, 0.62, -0.02]], 0.13, { radial: 20 })
  addMesh(svc, svcPath.geometry, svcMat)
  cap(svc, svcPath.curve, true, 0.13, vessel(env, 0x34479f), lumen())
  addFlow(svc, svcPath.curve, 0.13, 26)

  const ivc = make('inferior-vena-cava', 'vessel', [-0.7, -1, -0.2], { xray: 0.22 })
  const ivcMat = vessel(env, 0x3a4db0)
  const ivcPath = tube([[-0.5, -1.3, -0.4], [-0.6, -0.62, -0.28], [-0.7, 0.02, -0.1]], 0.14, { radial: 20 })
  addMesh(ivc, ivcPath.geometry, ivcMat)
  cap(ivc, ivcPath.curve, true, 0.14, vessel(env, 0x34479f), lumen())
  addFlow(ivc, ivcPath.curve, 0.14, 26)

  const pv = make('pulmonary-veins', 'vessel', [0.3, 0.2, -1.3], { xray: 0.22 })
  const pvMat = vessel(env, 0xc23a4c)
  const pvWall = vessel(env, 0xb53548)
  const pvLumen = lumen()
  for (const points of [
    [[-0.42, 0.62, -0.78], [-0.05, 0.55, -0.7], [0.1, 0.5, -0.62]],
    [[-0.42, 0.28, -0.82], [-0.05, 0.32, -0.72], [0.1, 0.36, -0.62]],
    [[1.08, 0.66, -0.72], [0.75, 0.56, -0.66], [0.58, 0.5, -0.6]],
    [[1.08, 0.3, -0.8], [0.75, 0.34, -0.7], [0.58, 0.38, -0.62]],
  ]) {
    const vein = tube(points, 0.075, { radial: 14 })
    addMesh(pv, vein.geometry, pvMat)
    cap(pv, vein.curve, true, 0.075, pvWall, pvLumen)
    addFlow(pv, vein.curve, 0.075, 12)
  }

  // Valves ------------------------------------------------------------------
  addValve(make('tricuspid', 'valve', [-0.3, 0, 0.1]),
    { center: [-0.44, 0.04, 0.2], normal: V(0.45, -0.8, 0.35), radius: 0.2, cusps: 3, kind: 'av', spin: 0.4 })
  addValve(make('mitral', 'valve', [0.3, 0, -0.1]),
    { center: [0.3, 0.06, -0.32], normal: V(0, -0.9, 0.42), radius: 0.19, cusps: 2, kind: 'av', spin: 0.2 })
  addValve(make('aortic-valve', 'valve', [0, 0.25, -0.1]),
    { center: [0.12, 0.33, -0.05], normal: aortaPath.curve.getTangentAt(0), radius: 0.15, cusps: 3, kind: 'semilunar' })
  addValve(make('pulmonary-valve', 'valve', [0.1, 0.25, 0.25]),
    { center: [0.02, 0.42, 0.4], normal: trunk.curve.getTangentAt(0), radius: 0.14, cusps: 3, kind: 'semilunar', spin: 1 })

  // Papillary muscles & chordae --------------------------------------------
  root.updateMatrixWorld(true)
  const papillary = make('papillary', 'papillary', [0, -0.45, 0])
  const papMat = tissue(env, 0xa0304a, { clip: false })
  const chordPoints = []
  const valveRim = (id, angle, r) => parts[id].inner.children[0].localToWorld(V(Math.cos(angle) * r, 0, Math.sin(angle) * r))
  for (const [base, valveId, angles] of [
    [V(0.5, -0.58, -0.02), 'mitral', [0.2, 0.9, -0.5]],
    [V(0.26, -0.62, -0.38), 'mitral', [2.6, 3.3, 3.9]],
    [V(-0.32, -0.5, 0.4), 'tricuspid', [0.3, 1.1]],
    [V(-0.06, -0.62, 0.42), 'tricuspid', [2.2, 3]],
    [V(-0.22, -0.62, 0.12), 'tricuspid', [4.2, 5]],
  ]) {
    const target = parts[valveId].inner.children[0].position
    const dir = target.clone().sub(base).normalize()
    const tip = base.clone().addScaledVector(dir, 0.3)
    addMesh(papillary, blob({ radii: [0.06, 0.16, 0.06], taper: 0.7, seed: base.x * 10, rough: 0.08 }), papMat, {
      position: base.clone().addScaledVector(dir, 0.15).toArray(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), dir),
    })
    for (const angle of angles) for (const r of [0.55, 0.85]) {
      chordPoints.push(tip, valveRim(valveId, angle, parts[valveId].inner.children[0].children[0].geometry.parameters.radius * r))
    }
  }
  const chordae = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(chordPoints),
    track(papillary, new THREE.LineBasicMaterial({ color: 0xf7e2d6 })))
  papillary.inner.add(chordae)

  // Coronary circulation (snapped onto the chamber surfaces) -----------------
  root.updateMatrixWorld(true)
  const outer = makeSurface([raMesh, raAuricle, laMesh, laAuricle, rvMesh, rvOutflow, lvMesh])
  const surfaceCenter = V(0.05, -0.2, 0)
  const vesselTree = (part, list, lift, material) => {
    const geometries = []
    for (const { points, radius, taper = 0.45 } of list) {
      const path = tube(surfacePath(outer, surfaceCenter, points, lift), radius, { taper, segments: 90, radial: 8 })
      geometries.push(path.geometry)
      addFlow(part, path.curve, radius, 16)
    }
    addMesh(part, mergeGeometries(geometries), material)
    geometries.forEach((geometry) => geometry.dispose())
  }
  const coronary = make('coronary-arteries', 'coronary', [0.25, -0.1, 1.3], { xray: 0.6, pulsatile: true })
  vesselTree(coronary, [
    { points: [[0.24, 0.38, 0.08], [0.32, 0.32, 0.22], [0.22, 0.05, 0.55], [0.22, -0.35, 0.62], [0.38, -0.8, 0.5], [0.6, -1.2, 0.3], [0.78, -1.45, 0.1]], radius: 0.032 },
    { points: [[0.32, 0.32, 0.22], [0.62, 0.22, 0.15], [0.85, 0, -0.25], [0.72, -0.2, -0.62], [0.4, -0.35, -0.75]], radius: 0.028 },
    { points: [[0.22, -0.2, 0.6], [0.55, -0.4, 0.5], [0.82, -0.75, 0.3]], radius: 0.02 },
    { points: [[0.85, 0, -0.25], [0.95, -0.45, -0.2], [0.9, -0.9, -0.15]], radius: 0.02 },
    { points: [[0, 0.38, 0.2], [-0.3, 0.18, 0.48], [-0.62, -0.02, 0.4], [-0.82, -0.25, 0.05], [-0.65, -0.45, -0.35], [-0.25, -0.6, -0.5]], radius: 0.032, taper: 0.7 },
    { points: [[-0.25, -0.6, -0.5], [0.1, -0.95, -0.45], [0.35, -1.25, -0.25]], radius: 0.022 },
    { points: [[-0.62, -0.02, 0.4], [-0.55, -0.45, 0.5], [-0.3, -0.8, 0.5]], radius: 0.02 },
  ], 0.024, vessel(env, 0xd8402f, { bumpScale: 0 }))

  const veins = make('cardiac-veins', 'coronary', [0.1, -0.3, -1.3], { xray: 0.6 })
  vesselTree(veins, [
    { points: [[0.42, -0.9, 0.52], [0.3, -0.4, 0.64], [0.12, 0.05, 0.58], [0.5, 0.2, 0.32], [0.82, 0.05, -0.15], [0.7, -0.12, -0.55]], radius: 0.022, taper: 1.6 },
    { points: [[0.7, -0.12, -0.55], [0.2, -0.16, -0.72], [-0.3, -0.06, -0.55], [-0.55, 0.05, -0.38]], radius: 0.045, taper: 1.2 },
    { points: [[0.32, -1.2, -0.3], [0.05, -0.85, -0.52], [-0.2, -0.4, -0.58]], radius: 0.018, taper: 1.6 },
    { points: [[-0.4, -0.62, 0.5], [-0.7, -0.15, 0.34], [-0.78, -0.12, -0.1]], radius: 0.016, taper: 1.5 },
  ], 0.034, vessel(env, 0x4e62d6, { bumpScale: 0 }))

  // Conduction system --------------------------------------------------------
  const tract = (part, material, points, radius, t0, t1, taper = 1) => {
    const path = tube(points, radius, { taper, segments: 48, radial: 8 })
    addMesh(part, path.geometry, material)
    addSegment(part, env, path.curve, t0, t1)
    return path
  }
  const sa = make('sa-node', 'conduction', [0, 0, 0], { timing: [0, 80] })
  const saMat = track(sa, glowing(0xffd84d, 0.6))
  const saPos = V(-0.6, 0.74, 0.12), avPos = V(-0.18, 0.1, 0.02)
  addMesh(sa, blob({ radii: [0.08, 0.045, 0.06], seed: 9, rough: 0.1 }), saMat, { position: saPos.toArray(), rotation: [0, 0, 0.6] })
  addHalo(sa, env, saPos, 0.5)
  for (const points of [
    [saPos, V(-0.42, 0.6, 0.25), V(-0.25, 0.35, 0.15), avPos],
    [saPos, V(-0.5, 0.45, 0.05), V(-0.3, 0.25, 0), avPos],
    [saPos, V(-0.75, 0.4, -0.15), V(-0.45, 0.12, -0.15), avPos],
  ]) tract(sa, saMat, points, 0.011, 0, 75)
  tract(sa, saMat, [saPos, V(-0.3, 0.72, 0), V(0.05, 0.68, -0.25), V(0.35, 0.6, -0.45)], 0.013, 0, 60)

  const av = make('av-node', 'conduction', [0, 0, 0], { timing: [75, 205] })
  const avMat = track(av, glowing(0xffb547, 0.6))
  addMesh(av, blob({ radii: [0.07, 0.04, 0.05], seed: 11, rough: 0.1 }), avMat, { position: avPos.toArray(), rotation: [0, 0.4, -0.3] })
  addHalo(av, env, avPos, 0.42)
  const hisEnd = V(0, -0.1, 0.08)
  tract(av, avMat, [avPos, V(-0.08, 0, 0.06), hisEnd], 0.02, 170, 205)

  const bundles = make('bundle-branches', 'conduction', [0, 0, 0], { timing: [205, 245] })
  const bbMat = track(bundles, glowing(0xff9f43, 0.6))
  const split = V(0.2, -0.5, -0.05)
  tract(bundles, bbMat, [hisEnd, V(-0.06, -0.45, 0.16), V(0, -0.85, 0.22), V(0.1, -1.05, 0.25)], 0.015, 205, 245, 0.6)
  tract(bundles, bbMat, [hisEnd, V(0.1, -0.3, 0), split], 0.017, 205, 222)
  tract(bundles, bbMat, [split, V(0.35, -0.75, 0.1), V(0.5, -1.05, 0.1)], 0.013, 222, 245, 0.6)
  tract(bundles, bbMat, [split, V(0.3, -0.8, -0.2), V(0.45, -1.1, -0.1)], 0.013, 222, 245, 0.6)

  const purkinje = make('purkinje', 'conduction', [0, 0, 0], { timing: [245, 290] })
  const pkMat = track(purkinje, glowing(0xffe27a, 0.3))
  const fibreGeometries = []
  const rand = random(42)
  for (const [mesh, count, height] of [[lvMesh, 11, 1.05], [rvMesh, 7, 0.82]]) {
    const surface = makeSurface([mesh])
    const axis = axisOf(mesh)
    const u = new THREE.Vector3().crossVectors(axis, V(0, 0, 1)).normalize()
    const w = new THREE.Vector3().crossVectors(axis, u)
    for (let k = 0; k < count; k++) {
      const a0 = (k / count) * Math.PI * 2 + rand() * 0.3
      const fibre = (from, to, twist) => {
        const points = []
        for (let s = 0; s <= 6; s++) {
          const f = from + (to - from) * (s / 6)
          const a = a0 + f * twist
          const center = mesh.position.clone().addScaledVector(axis, (-0.92 + f * 1.1) * height)
          const dir = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a))
          const hit = surface(center.clone().addScaledVector(dir, 3), dir.clone().negate())
          if (hit) points.push(hit.point.addScaledVector(hit.normal, -0.04))
        }
        if (points.length < 4) return
        const path = tube(points, 0.006, { taper: 0.45, segments: 40, radial: 6 })
        fibreGeometries.push(path.geometry)
        const delay = rand() * 12
        addSegment(purkinje, env, path.curve, 245 + delay, 290 + delay, 0.08)
      }
      fibre(0, 0.75, 0.5)
      fibre(0.3, 0.62, 1.6)
    }
  }
  addMesh(purkinje, mergeGeometries(fibreGeometries), pkMat)
  fibreGeometries.forEach((geometry) => geometry.dispose())

  // External autonomic nerves -----------------------------------------------
  const plexus = make('cardiac-plexus', 'nerve', [0, 1.2, 0.5], { xray: 0.9, timing: [-10, 120] })
  const nerveMat = track(plexus, glowing(0xd9b860, 0.18, { emissive: 0x9a7420, clippingPlanes: [cut] }))
  const nerves = [
    [[-0.92, 2, -0.2], [-0.84, 1.5, 0.02], [-0.78, 1.05, 0.12], [-0.64, 0.8, 0.2]],
    [[-0.22, 2.05, 0.22], [-0.17, 1.6, 0.27], [-0.12, 1.15, 0.3], [-0.1, 0.62, 0.52]],
    [[0.5, 2, -0.08], [0.64, 1.6, 0.04], [0.82, 1.2, 0.08], [0.86, 0.75, 0.04], [0.8, 0.42, 0.1]],
    [[0.1, 2, -0.75], [0.2, 1.5, -0.86], [0.3, 1, -0.88], [0.3, 0.72, -0.9]],
    [[-0.12, 1.15, 0.3], [0.2, 1.25, 0.45], [0.45, 1.15, 0.45], [0.62, 1.02, 0.2]],
  ]
  const nerveGeometries = []
  nerves.forEach((points, i) => {
    const path = tube(wiggle(points, 0.014, i * 1.7), 0.009, { segments: 80, radial: 6, taper: i === 4 ? 0.6 : 0.75 })
    nerveGeometries.push(path.geometry)
    addSegment(plexus, env, path.curve, -10 + i * 6, 120 + i * 6, 0.1)
  })
  addMesh(plexus, mergeGeometries(nerveGeometries), nerveMat)
  nerveGeometries.forEach((geometry) => geometry.dispose())
  const ganglion = new THREE.SphereGeometry(0.035, 14, 10)
  for (const p of [[-0.16, 1.62, 0.27], [0.64, 1.6, 0.04], [0.2, 1.5, -0.86], [-0.12, 1.15, 0.3]]) addMesh(plexus, ganglion, nerveMat, { position: p })

  // Finalize: pivot each part around its own center, then add effects -------
  root.updateMatrixWorld(true)
  for (const part of Object.values(parts)) {
    const box = new THREE.Box3().setFromObject(part.inner)
    const center = box.getCenter(new THREE.Vector3())
    part.center = center
    part.radius = box.getBoundingSphere(new THREE.Sphere()).radius
    part.pivot.position.copy(center)
    part.inner.position.copy(center).negate()
    part.segments.forEach(({ sprite }) => part.inner.add(sprite))
    part.halos.forEach(({ sprite }) => part.inner.add(sprite))
    if (part.flows.length) buildFlowMesh(part)
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'heart-label'
    element.textContent = part.info.name
    element.style.setProperty('--dot', part.info.color)
    part.label = new CSS2DObject(element)
    part.label.position.copy(labelAnchor(part))
    part.group.add(part.label)
  }

  return {
    root, parts, explode: 0, baseScale: 1,
    pickables: Object.values(parts).flatMap((part) => part.meshes),
    textures: [env.fibre, env.glowMap],
  }
}

function labelAnchor(part) {
  if (part.flows.length) return part.flows[0].curve.getPointAt(part.id === 'aorta' ? 0.32 : 0.55)
  const mesh = part.meshes[0]
  mesh.geometry.computeBoundingSphere()
  return mesh.localToWorld(mesh.geometry.boundingSphere.center.clone())
}

function buildFlowMesh(part) {
  const total = part.flows.reduce((sum, flow) => sum + flow.count, 0)
  const color = part.info.blood === 'oxygenated' ? new THREE.Color(1.1, 0.1, 0.14) : new THREE.Color(0.18, 0.32, 1.25)
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color }), total)
  mesh.frustumCulled = false
  mesh.visible = false
  const rand = random(part.id.length * 97)
  for (const flow of part.flows) {
    flow.offsets = Float32Array.from({ length: flow.count }, () => rand())
    flow.jitter = Array.from({ length: flow.count }, () =>
      V(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.9 * flow.radius))
    flow.size = clamp(flow.radius * 0.3, 0.007, 0.034)
  }
  part.flowMesh = mesh
  part.inner.add(mesh)
}

// ---------------------------------------------------------------- per frame

const pulse = (t, start, end) => t > start && t < end ? Math.sin(Math.PI * (t - start) / (end - start)) : 0
const windowed = (t, start, end, edge) => smoothstep(start, start + edge, t) * (1 - smoothstep(end - edge, end, t))
const flashAt = (t, start, end) => t < start ? 0 : t <= end ? 1 : Math.exp(-(t - end) / 160)
const dummy = new THREE.Object3D()
const point = new THREE.Vector3()

// f: { dt, time, tR (ms since R peak), rr (ms), selected, hovered, mode, explode, flow, isolate, labels }
export function updateHeart(model, f) {
  const ease = (rate) => 1 - Math.exp(-f.dt * rate)
  model.explode += (f.explode - model.explode) * ease(5)
  const k = clamp(f.rr / 800, 0.55, 1)
  const tSA = mod(f.tR + 260 * k, f.rr)
  const contraction = pulse(f.tR, 20 * k, 360 * k)
  const atrial = pulse(tSA, 80 * k, 240 * k)
  const semilunar = windowed(f.tR, 70 * k, 330 * k, 45 * k)
  const avOpen = 1 - windowed(f.tR, 0, 400 * k, 50 * k)
  model.root.scale.setScalar(model.baseScale * (1 - 0.028 * contraction + 0.01 * atrial))

  const selected = f.selected ? model.parts[f.selected] : null
  const seeThrough = f.mode === 'xray' || Boolean(selected?.internal && !f.isolate)

  for (const part of Object.values(model.parts)) {
    const isSelected = part === selected
    const revealed = f.mode !== 'exterior' || model.explode > 0.25 || isSelected || Boolean(selected && f.isolate) || seeThrough

    let target = seeThrough ? part.xray : 1
    if (f.flow && (part.kind === 'vessel' || part.kind === 'coronary') && !seeThrough) target = Math.min(target, 0.55)
    if (selected) {
      if (isSelected) target = part.flowMesh ? 0.62 : 1
      else if (f.isolate) target = Math.min(target, part.internal ? 0.08 : 0.045)
    }
    part.opacity += (target - part.opacity) * ease(6)
    const glowTarget = isSelected ? 0.3 + 0.12 * Math.sin(f.time * 3.5) : part.id === f.hovered ? 0.2 : 0
    part.highlight += (glowTarget - part.highlight) * ease(10)
    const flash = part.timing ? flashAt(tSA, part.timing[0] * k, part.timing[1] * k) : 0

    for (const material of part.materials) {
      const opacity = part.opacity * material.userData.baseOpacity
      material.opacity = opacity
      material.depthWrite = opacity > 0.6
      material.visible = opacity > 0.01
      if (material.userData.conduction) {
        material.emissiveIntensity = (material.userData.baseIntensity * (0.7 + 2.6 * flash) + part.highlight * 2) * Math.min(1, part.opacity * 1.4)
      } else if (material.emissive) {
        material.emissive.copy(material.userData.baseEmissive).lerp(part.glow, part.highlight)
      }
    }

    part.group.position.copy(part.explode).multiplyScalar(model.explode)

    if (part.kind === 'ventricle') {
      const amount = (isSelected ? 0.085 : 0.025) * contraction
      part.pivot.scale.set(1 - amount, 1 - amount * 0.6, 1 - amount)
    } else if (part.kind === 'atrium') {
      part.pivot.scale.setScalar(1 - (isSelected ? 0.11 : 0.035) * atrial)
    } else if (part.kind === 'papillary') {
      part.pivot.scale.set(1, 1 - 0.1 * contraction, 1)
    } else if (part.kind === 'valve') {
      part.pivot.scale.setScalar(isSelected ? 1.12 : 1)
    }

    if (part.valve) {
      const open = part.valve === 'semilunar' ? semilunar : avOpen
      for (const { pivot, axis } of part.leaflets) pivot.quaternion.setFromAxisAngle(axis, -(0.06 + open * 1.15))
    }

    if (part.flowMesh) {
      const show = (f.flow || isSelected) && part.opacity > 0.2
      part.flowMesh.visible = show
      if (show) {
        const speed = part.kind === 'coronary' ? (part.pulsatile ? 0.3 + 0.35 * (1 - contraction) : 0.3)
          : part.pulsatile ? 0.18 + 1.3 * semilunar : 0.38
        let index = 0
        for (const flow of part.flows) {
          flow.phase = (flow.phase + f.dt * speed / flow.length) % 1
          for (let i = 0; i < flow.count; i++, index++) {
            const t = (flow.offsets[i] + flow.phase) % 1
            flow.curve.getPointAt(t, point).add(flow.jitter[i])
            dummy.position.copy(point)
            dummy.scale.setScalar(flow.size * (0.4 + 0.6 * Math.min(1, t * 12, (1 - t) * 12)))
            dummy.updateMatrix()
            part.flowMesh.setMatrixAt(index, dummy.matrix)
          }
        }
        part.flowMesh.instanceMatrix.needsUpdate = true
      }
    }

    for (const segment of part.segments) {
      const t0 = segment.t0 * k, t1 = segment.t1 * k
      const visible = revealed && part.opacity > 0.05 && tSA >= t0 && tSA <= t1 + 30
      segment.sprite.visible = visible
      if (visible) {
        segment.curve.getPointAt(clamp((tSA - t0) / (t1 - t0), 0, 1), segment.sprite.position)
        segment.sprite.material.opacity = part.opacity * (tSA > t1 ? 1 - (tSA - t1) / 30 : 1)
      }
    }
    for (const halo of part.halos) {
      halo.sprite.visible = revealed
      halo.sprite.material.opacity = part.opacity * (0.25 + 0.75 * flash)
      halo.sprite.scale.setScalar(halo.size * (0.6 + 0.5 * flash))
    }

    const showLabel = f.labels && (!part.internal || revealed) && part.opacity > 0.25
    const element = part.label.element
    element.classList.toggle('is-visible', showLabel)
    element.classList.toggle('is-active', isSelected)
  }
}

export function disposeHeart(model) {
  model.root.traverse((object) => {
    object.geometry?.dispose()
    if (object.material) [object.material].flat().forEach((material) => material.dispose())
    if (object.isCSS2DObject) object.element.remove()
  })
  model.textures.forEach((texture) => texture.dispose())
}
