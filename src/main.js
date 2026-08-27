import './style.css'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

// Detecta si el dispositivo se controla principalmente por touch, para
// mostrar los controles en pantalla en vez de depender del teclado.
// (El meta viewport correcto ahora vive directamente en index.html.)
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window

document.querySelector('#app').innerHTML = `
  <div class="hud">
    <div class="brand">
      <p class="eyebrow">For Auri</p>
      <h1>Derly's Game 3D</h1>
      <p class="subtitle">Esquiva los obstaculos - Acelera sin limites - Llega hasta el final.</p>
    </div>
    <div class="stats">
      <div class="stat">
        <span>Speed</span>
        <strong id="speed">0 km/h</strong>
      </div>
      <div class="stat">
        <span>Progress</span>
        <strong id="progress">0%</strong>
      </div>
      <div class="stat">
        <span>Place</span>
        <strong id="place">1 / 4</strong>
      </div>
      <div class="stat">
        <span>Level</span>
        <strong id="level">1 / 3</strong>
      </div>
    </div>
  </div>
  <div class="game-shell">
    <canvas class="game-canvas"></canvas>
    <div id="setup-overlay" style="position:fixed; inset:0; z-index:6; display:flex; align-items:center; justify-content:center; background:rgba(5,10,20,0.72); backdrop-filter:blur(6px); padding:1.5rem;">
      <div style="width:min(92vw, 26rem); background:rgba(15,23,42,0.92); border:1px solid rgba(255,255,255,0.14); border-radius:1.1rem; padding:1.6rem; color:#e8edf7; box-shadow:0 20px 60px rgba(0,0,0,0.45); font-family:inherit;">
        <p style="margin:0 0 0.3rem; text-transform:uppercase; letter-spacing:0.16em; font-size:0.7rem; color:#7dd3fc;">Antes de arrancar</p>
        <h2 style="margin:0 0 1.1rem; font-size:1.5rem;">Personaliza tu coche</h2>
        <label style="display:block; font-size:0.85rem; color:#cbd5e1; margin-bottom:0.4rem;">Nombre del piloto</label>
        <input id="setup-name" type="text" maxlength="14" value="Derly" style="width:100%; box-sizing:border-box; padding:0.6rem 0.75rem; border-radius:0.6rem; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.06); color:#fff; font-size:1rem; margin-bottom:1.2rem;" />
        <label style="display:block; font-size:0.85rem; color:#cbd5e1; margin-bottom:0.5rem;">Color del coche</label>
        <div id="setup-colors" style="display:flex; flex-wrap:wrap; gap:0.6rem; margin-bottom:1.4rem;"></div>
        <button id="setup-start" type="button" style="width:100%; padding:0.85rem 1rem; border:none; border-radius:0.9rem; background:linear-gradient(135deg, #38bdf8, #2563eb); color:white; cursor:pointer; font-weight:700; font-size:1rem;">Comenzar carrera</button>
      </div>
    </div>
    <div id="countdown" class="countdown hidden"></div>
    <div id="message" class="message hidden">
      <h2 id="message-title">Finish Line</h2>
      <p id="message-text">Press <kbd>R</kbd> to restart the race.</p>
      <button id="retry-level" type="button">Reintentar</button>
      <button id="restart-level1" type="button" class="hidden">Reiniciar desde Nivel 1</button>
      <button id="customize-vehicle" type="button" class="hidden">Personalizar vehículo</button>
    </div>
    <button id="touch-restart" class="touch-restart" type="button" aria-label="Reiniciar">⟳</button>
    <div id="touch-controls" class="touch-controls">
      <div class="touch-group touch-steer">
        <button id="touch-left" class="touch-btn" type="button" aria-label="Izquierda">◀</button>
        <button id="touch-right" class="touch-btn" type="button" aria-label="Derecha">▶</button>
      </div>
      <div class="touch-group touch-pedals">
        <button id="touch-accelerate" class="touch-btn touch-btn--gas" type="button" aria-label="Acelerar">GAS</button>
        <button id="touch-brake" class="touch-btn touch-btn--brake" type="button" aria-label="Frenar">FRENO</button>
      </div>
    </div>
  </div>
  <div class="controls">
    <span><kbd>W</kbd> or <kbd>↑</kbd> accelerate</span>
    <span><kbd>S</kbd> or <kbd>↓</kbd> brake</span>
    <span><kbd>A</kbd> <kbd>D</kbd> or <kbd>←</kbd> <kbd>→</kbd> steer</span>
    <span><kbd>R</kbd> restart</span>
  </div>
`

const canvas = document.querySelector('.game-canvas')
const speedLabel = document.querySelector('#speed')
const progressLabel = document.querySelector('#progress')
const placeLabel = document.querySelector('#place')
const levelLabel = document.querySelector('#level')
const messagePanel = document.querySelector('#message')
const countdownLabel = document.querySelector('#countdown')
const messageTitle = document.querySelector('#message-title')
const messageText = document.querySelector('#message-text')
const restartLevel1Button = document.querySelector('#restart-level1')
const customizeVehicleButton = document.querySelector('#customize-vehicle')
const retryLevelButton = document.querySelector('#retry-level')
const setupOverlay = document.querySelector('#setup-overlay')
const setupNameInput = document.querySelector('#setup-name')
const setupColorsContainer = document.querySelector('#setup-colors')
const setupStartButton = document.querySelector('#setup-start')
const touchRestartButton = document.querySelector('#touch-restart')
const touchLeftButton = document.querySelector('#touch-left')
const touchRightButton = document.querySelector('#touch-right')
const touchAccelerateButton = document.querySelector('#touch-accelerate')
const touchBrakeButton = document.querySelector('#touch-brake')

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87b6ff)
scene.fog = new THREE.Fog(0x87b6ff, 80, 175)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400)
camera.position.set(0, 8, 22)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// Renderer aparte (DOM, no WebGL) para las etiquetas con el nombre de cada
// piloto, que flotan sobre su coche y siempre miran a la camara.
const gameShell = document.querySelector('.game-shell')
gameShell.style.position = gameShell.style.position || 'relative'

const labelRenderer = new CSS2DRenderer()
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.left = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
gameShell.appendChild(labelRenderer.domElement)

const ambientLight = new THREE.HemisphereLight(0xf4f7ff, 0x34503b, 1.9)
scene.add(ambientLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 2.6)
const sunOffset = new THREE.Vector3(18, 28, 10)
sunLight.position.copy(sunOffset)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(2048, 2048)
sunLight.shadow.camera.near = 1
sunLight.shadow.camera.far = 80
sunLight.shadow.camera.left = -30
sunLight.shadow.camera.right = 30
sunLight.shadow.camera.top = 30
sunLight.shadow.camera.bottom = -30
scene.add(sunLight)
scene.add(sunLight.target)

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(4, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xffeea0 }),
)
sun.position.set(-38, 30, -180)
scene.add(sun)

/* ------------------------------------------------------------------
 * CIRCUITO: define la forma de la pista como una lista de puntos.
 * Ajusta estos valores (x, z) para cambiar la forma, largo o dificultad
 * del circuito. La curva se cierra sola (closed: true), así que el
 * último punto se conecta suavemente con el primero.
 * ------------------------------------------------------------------ */
function createRoundedRectTrack(halfWidth, halfHeight, radius, segmentsPerCorner, straightSegments, zigzag) {
  const points = []
  const corners = [
    { center: [halfWidth - radius, halfHeight - radius], startAngle: Math.PI / 2, endAngle: 0 },
    { center: [halfWidth - radius, -halfHeight + radius], startAngle: 0, endAngle: -Math.PI / 2 },
    { center: [-halfWidth + radius, -halfHeight + radius], startAngle: -Math.PI / 2, endAngle: -Math.PI },
    { center: [-halfWidth + radius, halfHeight - radius], startAngle: Math.PI, endAngle: Math.PI / 2 },
  ]

  corners.forEach(({ center, startAngle, endAngle }, cornerIndex) => {
    for (let index = 0; index <= segmentsPerCorner; index += 1) {
      const angle = THREE.MathUtils.lerp(startAngle, endAngle, index / segmentsPerCorner)
      points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius])
    }

    // Puntos intermedios a lo largo del tramo recto que conecta con la siguiente esquina.
    // Sin esto, el tramo recto solo tenia 2 puntos y Catmull-Rom podia "rebotar" justo
    // en la transicion curva -> recta, generando el parche de carretera deforme.
    const nextCorner = corners[(cornerIndex + 1) % corners.length]
    const cornerEnd = [center[0] + Math.cos(endAngle) * radius, center[1] + Math.sin(endAngle) * radius]
    const nextStart = [
      nextCorner.center[0] + Math.cos(nextCorner.startAngle) * radius,
      nextCorner.center[1] + Math.sin(nextCorner.startAngle) * radius,
    ]

    // Vector perpendicular al tramo recto, para poder desplazar puntos hacia los lados
    // y formar un zigzag/chicane en vez de depender de un radio de curva muy cerrado.
    const dx = nextStart[0] - cornerEnd[0]
    const dz = nextStart[1] - cornerEnd[1]
    const straightLength = Math.hypot(dx, dz) || 1
    const perpX = -dz / straightLength
    const perpZ = dx / straightLength

    for (let index = 1; index < straightSegments; index += 1) {
      const t = index / straightSegments
      const baseX = THREE.MathUtils.lerp(cornerEnd[0], nextStart[0], t)
      const baseZ = THREE.MathUtils.lerp(cornerEnd[1], nextStart[1], t)
      // sin(t * PI * count) vale 0 en t=0 y t=1, asi que el zigzag empalma sin saltos
      // con la esquina anterior y la siguiente.
      // sin(t*PI) * sin(t*PI*count) vale 0 Y tiene pendiente 0 en t=0 y t=1 (para count
      // entero), asi que el zigzag entra y sale de la curva sin ningun quiebre brusco.
      const offset = zigzag
        ? Math.sin(t * Math.PI) * Math.sin(t * Math.PI * zigzag.count) * zigzag.amplitude
        : 0
      points.push([baseX + perpX * offset, baseZ + perpZ * offset])
    }
  })

  return points
}

// Cada nivel tiene una forma de circuito distinta (no son la misma pista reescalada) y
// rivales mas rapidos. El radio de las esquinas se mantiene en un rango seguro para que
// Catmull-Rom no "rebote"; la dificultad extra viene del zigzag en los tramos rectos
// (un solo barrido amplio por tramo, count: 1 = zigzag largo y suave), no de cerrar mas
// el radio de las esquinas. obstacleCount controla cuantos conos/barriles hay que esquivar.
const trackLevels = [
  {
    halfWidth: 170,
    halfHeight: 150,
    radius: 75,
    straightSegments: 6,
    zigzag: null,
    rivalMultiplier: 1,
    obstacleCount: 30,
  },
  {
    halfWidth: 195,
    halfHeight: 120,
    radius: 55,
    straightSegments: 12,
    zigzag: { amplitude: 9, count: 1 },
    rivalMultiplier: 1.12,
    obstacleCount: 35,
  },
  {
    halfWidth: 175,
    halfHeight: 150,
    radius: 55,
    straightSegments: 16,
    zigzag: { amplitude: 14, count: 1 },
    rivalMultiplier: 1.25,
    obstacleCount: 40,
  },
]

const roadWidth = 18
const laneOffsets = [-6, -2, 2, 6]

let curve
let curveLength

function getCurveFrame(t) {
  const clampedT = THREE.MathUtils.clamp(t, 0, 1)
  const point = curve.getPointAt(clampedT)
  const tangent = curve.getTangentAt(clampedT).normalize()
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
  const angle = Math.atan2(-tangent.x, -tangent.z)
  return { point, tangent, normal, angle }
}

function buildRoadGeometry(segments, width) {
  const positions = []
  const uvs = []

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const { point, normal } = getCurveFrame(t)
    const left = point.clone().addScaledVector(normal, width / 2)
    const right = point.clone().addScaledVector(normal, -width / 2)
    positions.push(left.x, 0.02, left.z)
    positions.push(right.x, 0.02, right.z)
    uvs.push(0, t * 60)
    uvs.push(1, t * 60)
  }

  const indices = []
  for (let index = 0; index < segments; index += 1) {
    const a = index * 2
    const b = index * 2 + 1
    const c = index * 2 + 2
    const d = index * 2 + 3
    indices.push(a, b, c, b, d, c)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// Terreno fijo, generoso, cubre el nivel mas grande (nivel 1) para no tener que
// reconstruirlo cuando cambia el nivel.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 800),
  new THREE.MeshStandardMaterial({ color: 0x4f7d43 }),
)
ground.rotation.x = -Math.PI / 2
ground.position.set(0, -0.02, 0)
ground.receiveShadow = true
scene.add(ground)

// Clona una geometria y la "hornea" ya trasladada/rotada a su posicion final,
// para poder combinar cientos de copias en una sola malla despues.
function transformGeometry(geometry, x, y, z, rotationY) {
  const geo = geometry.clone()
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    new THREE.Vector3(1, 1, 1),
  )
  geo.applyMatrix4(matrix)
  return geo
}

const laneMarkingGeometry = new THREE.BoxGeometry(0.22, 0.05, 4.5)
const laneMarkingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x808080 })
const laneMarkingOffsets = [-4, 0, 4]
const laneMarkingSpacing = 9

const barrierBaseGeometry = new THREE.BoxGeometry(0.7, 0.55, 3.2)
const barrierBaseMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f4f4 })
const barrierStripeGeometry = new THREE.BoxGeometry(0.72, 0.18, 3.22)
const barrierStripeMaterial = new THREE.MeshStandardMaterial({ color: 0xd94646 })
const barrierSpacing = 8

const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.28, 1.6, 10)
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6f4b2d })
const leavesGeometry = new THREE.ConeGeometry(1.2, 2.8, 12)
const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x1f8d44 })
const treeSpacing = 14
const infieldSpacing = 20

/* ------------------------------------------------------------------
 * OBSTACULOS: conos y barriles esparcidos sobre la pista que hay que
 * esquivar. Son estaticos (no se mueven), se reconstruyen con
 * buildObstacles() cada vez que cambia el nivel, y solo colisionan
 * con el coche del jugador (los rivales pasan de largo).
 * ------------------------------------------------------------------ */
function createConeMesh() {
  const group = new THREE.Group()

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a }),
  )
  base.position.y = 0.06
  base.castShadow = true
  base.receiveShadow = true

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.9, 16),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a }),
  )
  cone.position.y = 0.57
  cone.castShadow = true

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.34, 0.16, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  )
  stripe.position.y = 0.65

  group.add(base, cone, stripe)
  return group
}

function createBarrelMesh() {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1.1, 16),
    new THREE.MeshStandardMaterial({ color: 0xd94646 }),
  )
  body.position.y = 0.55
  body.castShadow = true
  body.receiveShadow = true

  const bandTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.53, 0.53, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  )
  bandTop.position.y = 0.9

  const bandBottom = bandTop.clone()
  bandBottom.position.y = 0.25

  group.add(body, bandTop, bandBottom)
  return group
}

let obstacles = []

function disposeObstacles() {
  obstacles.forEach(({ mesh }) => {
    scene.remove(mesh)
    mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose()
      }
    })
  })
  obstacles = []
}

function buildObstacles(levelConfig) {
  disposeObstacles()

  const obstacleCount = levelConfig.obstacleCount || 0
  if (obstacleCount === 0) {
    return
  }

  // El hueco minimo ahora solo aplica entre obstaculos "cercanos" en carril,
  // asi que carriles distintos pueden tener obstaculos casi al mismo t.
  const minGapT = 0.045
  const laneGapThreshold = 3 // si la diferencia de carril es mayor, no exigimos separacion en t
  const placed = [] // { t, lateralOffset }
  let attempts = 0
  const maxAttempts = obstacleCount * 60 // mas intentos, porque ahora es mas facil encontrar hueco

  while (obstacles.length < obstacleCount && attempts < maxAttempts) {
    attempts += 1
    const t = THREE.MathUtils.lerp(0.05, 0.97, Math.random())
    const lateralOffset = laneOffsets[Math.floor(Math.random() * laneOffsets.length)]

    const tooClose = placed.some((other) => {
      const laneDiff = Math.abs(other.lateralOffset - lateralOffset)
      // Si estan en carriles lejanos, no hace falta separacion en t (no chocan)
      if (laneDiff > laneGapThreshold) return false
      return Math.abs(other.t - t) < minGapT
    })
    if (tooClose) {
      continue
    }
    placed.push({ t, lateralOffset })

    const frame = getCurveFrame(t)
    const pos = frame.point.clone().addScaledVector(frame.normal, lateralOffset)

    const mesh = Math.random() < 0.5 ? createConeMesh() : createBarrelMesh()
    mesh.position.set(pos.x, 0, pos.z)
    mesh.rotation.y = frame.angle
    scene.add(mesh)

    obstacles.push({ t, lateralOffset, mesh })
  }
}

// Mallas que se reconstruyen cada vez que cambia el nivel.
let road
let laneMarkings
let barrierBases
let barrierStripes
let trunks
let leaves
let infieldTrunks
let infieldLeaves
let finishLine

function disposeTrackMeshes() {
  ;[road, laneMarkings, barrierBases, barrierStripes, trunks, leaves, infieldTrunks, infieldLeaves].forEach(
    (mesh) => {
      if (!mesh) {
        return
      }
      scene.remove(mesh)
      mesh.geometry.dispose()
    },
  )
}

function buildTrackGeometry(levelConfig) {
  disposeTrackMeshes()

  const trackPoints = createRoundedRectTrack(
    levelConfig.halfWidth,
    levelConfig.halfHeight,
    levelConfig.radius,
    12,
    levelConfig.straightSegments,
    levelConfig.zigzag,
  )

  curve = new THREE.CatmullRomCurve3(
    trackPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'catmullrom',
    0.5,
  )
  curve.arcLengthDivisions = 400
  curveLength = curve.getLength()

  road = new THREE.Mesh(buildRoadGeometry(400, roadWidth), new THREE.MeshStandardMaterial({ color: 0x2f3138 }))
  road.receiveShadow = true
  scene.add(road)

  // Lineas de carril
  const laneMarkingCount = Math.floor(curveLength / laneMarkingSpacing)
  const laneMarkingParts = []
  for (let index = 0; index < laneMarkingCount; index += 1) {
    const t = (index * laneMarkingSpacing) / curveLength
    const frame = getCurveFrame(t)
    laneMarkingOffsets.forEach((offset) => {
      const pos = frame.point.clone().addScaledVector(frame.normal, offset)
      laneMarkingParts.push(transformGeometry(laneMarkingGeometry, pos.x, 0.03, pos.z, frame.angle))
    })
  }
  laneMarkings = new THREE.Mesh(mergeGeometries(laneMarkingParts), laneMarkingMaterial)
  laneMarkings.receiveShadow = true
  scene.add(laneMarkings)

  // Barreras
  const barrierCount = Math.floor(curveLength / barrierSpacing)
  const barrierBaseParts = []
  const barrierStripeParts = []
  for (let index = 0; index < barrierCount; index += 1) {
    const t = (index * barrierSpacing) / curveLength
    const frame = getCurveFrame(t)

    const leftPos = frame.point.clone().addScaledVector(frame.normal, roadWidth / 2 + 1.15)
    barrierBaseParts.push(transformGeometry(barrierBaseGeometry, leftPos.x, 0.27, leftPos.z, frame.angle))
    barrierStripeParts.push(transformGeometry(barrierStripeGeometry, leftPos.x, 0.39, leftPos.z, frame.angle))

    const rightPos = frame.point.clone().addScaledVector(frame.normal, -(roadWidth / 2 + 1.15))
    barrierBaseParts.push(transformGeometry(barrierBaseGeometry, rightPos.x, 0.27, rightPos.z, frame.angle))
    barrierStripeParts.push(transformGeometry(barrierStripeGeometry, rightPos.x, 0.39, rightPos.z, frame.angle))
  }
  barrierBases = new THREE.Mesh(mergeGeometries(barrierBaseParts), barrierBaseMaterial)
  barrierBases.receiveShadow = true
  scene.add(barrierBases)
  barrierStripes = new THREE.Mesh(mergeGeometries(barrierStripeParts), barrierStripeMaterial)
  scene.add(barrierStripes)

  // Arboles junto a la pista
  const treeCount = Math.floor(curveLength / treeSpacing)
  const trunkParts = []
  const leafParts = []
  for (let index = 0; index < treeCount; index += 1) {
    const t = (index * treeSpacing) / curveLength
    const frame = getCurveFrame(t)

    const leftPos = frame.point.clone().addScaledVector(frame.normal, roadWidth / 2 + 9)
    trunkParts.push(transformGeometry(trunkGeometry, leftPos.x, 0.8, leftPos.z, 0))
    leafParts.push(transformGeometry(leavesGeometry, leftPos.x, 2.55, leftPos.z, 0))

    const rightPos = frame.point.clone().addScaledVector(frame.normal, -(roadWidth / 2 + 9))
    trunkParts.push(transformGeometry(trunkGeometry, rightPos.x, 0.8, rightPos.z, 0))
    leafParts.push(transformGeometry(leavesGeometry, rightPos.x, 2.55, rightPos.z, 0))
  }
  trunks = new THREE.Mesh(mergeGeometries(trunkParts), trunkMaterial)
  scene.add(trunks)
  leaves = new THREE.Mesh(mergeGeometries(leafParts), leavesMaterial)
  scene.add(leaves)

  // Arboles dentro del circuito (infield), para que la camara no vea "a traves" en las curvas
  const trackBounds = new THREE.Box3().setFromPoints(trackPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)))
  const trackSamplePoints = []
  for (let index = 0; index <= 200; index += 1) {
    trackSamplePoints.push(getCurveFrame(index / 200).point)
  }
  const isFarFromTrack = (x, z, minDistance) =>
    trackSamplePoints.every((point) => {
      const dx = point.x - x
      const dz = point.z - z
      return dx * dx + dz * dz > minDistance * minDistance
    })

  const infieldTrunkParts = []
  const infieldLeafParts = []
  for (let x = trackBounds.min.x; x <= trackBounds.max.x; x += infieldSpacing) {
    for (let z = trackBounds.min.z; z <= trackBounds.max.z; z += infieldSpacing) {
      if (isFarFromTrack(x, z, roadWidth / 2 + 12) && Math.random() < 0.6) {
        const jitterX = x + (Math.random() - 0.5) * infieldSpacing * 0.6
        const jitterZ = z + (Math.random() - 0.5) * infieldSpacing * 0.6
        infieldTrunkParts.push(transformGeometry(trunkGeometry, jitterX, 0.8, jitterZ, 0))
        infieldLeafParts.push(transformGeometry(leavesGeometry, jitterX, 2.55, jitterZ, 0))
      }
    }
  }
  if (infieldTrunkParts.length > 0) {
    infieldTrunks = new THREE.Mesh(mergeGeometries(infieldTrunkParts), trunkMaterial)
    scene.add(infieldTrunks)
    infieldLeaves = new THREE.Mesh(mergeGeometries(infieldLeafParts), leavesMaterial)
    scene.add(infieldLeaves)
  } else {
    infieldTrunks = undefined
    infieldLeaves = undefined
  }

  // Obstaculos (conos y barriles) que hay que esquivar en este nivel
  buildObstacles(levelConfig)

  // Reposiciona la meta al nuevo punto de partida (t = 0) de este nivel
  if (finishLine) {
    const startFrame = getCurveFrame(0)
    finishLine.group.position.set(startFrame.point.x, 0, startFrame.point.z)
    finishLine.group.rotation.y = startFrame.angle
  }
}

function createFinishLine() {
  const group = new THREE.Group()
  const checkerSize = 1.5

  for (let index = 0; index < 12; index += 1) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(checkerSize, 0.08, 2.8),
      new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? 0xffffff : 0x111111 }),
    )
    tile.position.set(-roadWidth / 2 + checkerSize / 2 + index * checkerSize, 0.05, 0)
    tile.receiveShadow = true
    group.add(tile)
  }

  const poleGeometry = new THREE.CylinderGeometry(0.18, 0.18, 8, 12)
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.4, roughness: 0.4 })

  const leftPole = new THREE.Mesh(poleGeometry, poleMaterial)
  leftPole.position.set(-roadWidth / 2 - 0.9, 4, 0)
  leftPole.castShadow = true

  const rightPole = new THREE.Mesh(poleGeometry, poleMaterial)
  rightPole.position.set(roadWidth / 2 + 0.9, 4, 0)
  rightPole.castShadow = true

  const banner = new THREE.Group()
  for (let index = 0; index < 10; index += 1) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1.1, 0.35),
      new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? 0xffffff : 0x111111 }),
    )
    block.position.set(-9 + index * 2, 8.15, 0)
    block.castShadow = true
    banner.add(block)
  }

  const flagPole = new THREE.Mesh(poleGeometry, poleMaterial)
  flagPole.position.set(roadWidth / 2 + 4, 3.5, -5)
  flagPole.castShadow = true

  const flagMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x1f2937,
    side: THREE.DoubleSide,
  })
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), flagMaterial)
  flag.position.set(roadWidth / 2 + 5.8, 5.1, -5)
  flag.castShadow = true

  const winnerPlate = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.4, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x6b7280 }),
  )
  winnerPlate.position.set(roadWidth / 2 + 4, 0.22, -7.5)
  winnerPlate.receiveShadow = true

  group.add(leftPole, rightPole, banner, flagPole, flag, winnerPlate)

  return { group, flag, flagMaterial }
}

finishLine = createFinishLine()
scene.add(finishLine.group)
buildTrackGeometry(trackLevels[0])

function createWheel() {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.5, 18),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }),
  )
  wheel.rotation.z = Math.PI / 2
  wheel.castShadow = true
  return wheel
}

function createCar({ color, accent }) {
  const car = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.8, 4.8),
    new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.45 }),
  )
  body.position.y = 0.85
  body.castShadow = true
  car.add(body)

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.8, 2.2),
    new THREE.MeshStandardMaterial({ color: accent, metalness: 0.15, roughness: 0.2 }),
  )
  cabin.position.set(0, 1.35, -0.1)
  cabin.castShadow = true
  car.add(cabin)

  const spoiler = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.12, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x0c1d34 }),
  )
  spoiler.position.set(0, 1.2, 2.1)
  spoiler.castShadow = true
  car.add(spoiler)

  const wheelPositions = [
    [-1.1, 0.4, -1.5],
    [1.1, 0.4, -1.5],
    [-1.1, 0.4, 1.45],
    [1.1, 0.4, 1.45],
  ]

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = createWheel()
    wheel.position.set(x, y, z)
    car.add(wheel)
  })

  const headlights = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.12, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xfef3b0, emissive: 0xc3b14e }),
  )
  headlights.position.set(0, 0.88, -2.4)
  car.add(headlights)

  car.userData.body = body
  return car
}

function resizeRenderer() {
  const width = window.innerWidth
  const height = window.innerHeight
  renderer.setSize(width, height)
  labelRenderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function hexToRgbString(color) {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  return `${r}, ${g}, ${b}`
}

// Crea la etiqueta HTML con el nombre del piloto que flota sobre su coche.
function createNameLabel(text, color) {
  const el = document.createElement('div')
  el.textContent = text

  el.style.padding = '3px 10px'
  el.style.borderRadius = '999px'
  el.style.fontFamily = 'inherit'
  el.style.fontSize = '12px'
  el.style.fontWeight = '700'
  el.style.letterSpacing = '0.02em'
  el.style.color = '#ffffff'
  el.style.background = `rgba(${hexToRgbString(color)}, 0.85)`
  el.style.border = '1px solid rgba(255, 255, 255, 0.5)'
  el.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.55)'
  el.style.whiteSpace = 'nowrap'
  el.style.transform = 'translateY(-4px)'

  const label = new CSS2DObject(el)
  label.position.set(0, 2.5, 0)
  return label
}

// Opciones de color para la antesala (evitando los colores ya usados por los rivales).
const carColorOptions = [0x6a0dad, 0x1479ff, 0xe83e8c, 0x22d3ee, 0xf97316, 0x84cc16, 0xf43f5e, 0xf4f6fb]
let pendingName = ''
let pendingColor = carColorOptions[0]

const playerCar = createCar({ color: pendingColor, accent: 0xdfe8f7 })
playerCar.userData.name = pendingName
playerCar.userData.color = pendingColor
const playerNameLabel = createNameLabel(playerCar.userData.name, playerCar.userData.color)
playerCar.add(playerNameLabel)
scene.add(playerCar)

const rivals = [
  { name: 'Blaze', color: 0xff5f45, laneIndex: 0, cruiseSpeed: 83, topSpeed: 98 },
  { name: 'Nova', color: 0x27d17c, laneIndex: 2, cruiseSpeed: 80, topSpeed: 95 },
  { name: 'Comet', color: 0xffd24a, laneIndex: 3, cruiseSpeed: 85, topSpeed: 99 },
].map((config) => {
  const rival = createCar({ color: config.color, accent: 0xe8eef6 })
  rival.userData.name = config.name
  rival.userData.color = config.color
  rival.userData.laneIndex = config.laneIndex
  rival.userData.baseCruiseSpeed = config.cruiseSpeed
  rival.userData.baseTopSpeed = config.topSpeed
  rival.userData.cruiseSpeed = config.cruiseSpeed
  rival.userData.topSpeed = config.topSpeed
  rival.userData.speed = 0
  rival.userData.wobbleSeed = Math.random() * Math.PI * 2
  rival.add(createNameLabel(rival.userData.name, rival.userData.color))
  scene.add(rival)
  return rival
})

function applyLevelToRivals(levelConfig) {
  rivals.forEach((rival) => {
    rival.userData.cruiseSpeed = rival.userData.baseCruiseSpeed * levelConfig.rivalMultiplier
    rival.userData.topSpeed = rival.userData.baseTopSpeed * levelConfig.rivalMultiplier
  })
}

const racers = [playerCar, ...rivals]

/* ------------------------------------------------------------------
 * ANTESALA: pantalla previa donde se elige nombre y color del coche.
 * Mientras no se confirme (state.setupComplete === false), el conteo
 * regresivo no avanza y el teclado no controla el coche.
 * ------------------------------------------------------------------ */
function renderColorSwatches() {
  setupColorsContainer.innerHTML = ''
  carColorOptions.forEach((color) => {
    const swatch = document.createElement('button')
    swatch.type = 'button'
    swatch.style.width = '2.1rem'
    swatch.style.height = '2.1rem'
    swatch.style.borderRadius = '50%'
    swatch.style.cursor = 'pointer'
    swatch.style.background = `rgb(${hexToRgbString(color)})`
    swatch.style.border = color === pendingColor ? '3px solid #ffffff' : '3px solid rgba(255,255,255,0.25)'
    swatch.style.boxShadow = color === pendingColor ? '0 0 0 2px rgba(56,189,248,0.6)' : 'none'
    swatch.addEventListener('click', () => {
      pendingColor = color
      renderColorSwatches()
    })
    setupColorsContainer.appendChild(swatch)
  })
}

renderColorSwatches()
setupNameInput.value = pendingName
setupNameInput.addEventListener('input', () => {
  pendingName = setupNameInput.value
})

setupStartButton.addEventListener('click', () => {
  const finalName = pendingName.trim() || 'Piloto'

  playerCar.userData.name = finalName
  playerCar.userData.color = pendingColor
  playerCar.userData.body.material.color.setHex(pendingColor)
  playerNameLabel.element.textContent = finalName
  playerNameLabel.element.style.background = `rgba(${hexToRgbString(pendingColor)}, 0.85)`

  setupOverlay.style.display = 'none'
  state.setupComplete = true
  restartRace()
})

// Reabre la antesala para cambiar nombre/color a mitad de partida. Vuelve a poner
// setupComplete en false, asi que el conteo se pausa y el teclado se ignora hasta
// que se confirme de nuevo desde el boton "Comenzar carrera".
function openCustomizeVehicle() {
  state.setupComplete = false
  setupNameInput.value = pendingName
  renderColorSwatches()
  setupOverlay.style.display = 'flex'
}

const state = {
  speed: 0,
  maxSpeed: 110,
  progress: 0,
  place: 1,
  level: 1,
  pendingLevelUp: false,
  raceFinished: false,
  raceStarted: false,
  setupComplete: false,
  countdownStep: 3,
  countdownStepTimer: 1,
  winner: null,
  winnerTime: 0,
  messageVisible: false,
  steerDirection: 0,
  collisionTimer: 0,
}

const input = {
  left: false,
  right: false,
  accelerate: false,
  brake: false,
}

const clock = new THREE.Clock()

function updateHud() {
  speedLabel.textContent = `${Math.round(state.speed)} km/h`
  progressLabel.textContent = `${Math.round(state.progress * 100)}%`
  placeLabel.textContent = `${state.place} / ${racers.length}`
  levelLabel.textContent = `${state.level} / ${trackLevels.length}`
}

// Texto de "reiniciar" adaptado al dispositivo: en touch no hay tecla R,
// asi que se referencia el boton ⟳ en pantalla en su lugar.
const restartHint = 'usa el botón <strong>Reintentar</strong>'

function setMessage(title, text, visible) {
  state.messageVisible = visible
  messageTitle.textContent = title
  messageText.innerHTML = text
  messagePanel.classList.toggle('hidden', !visible)
}

function placeCarOnTrack(car) {
  const frame = getCurveFrame(car.userData.t)
  const lateral = frame.normal.clone().multiplyScalar(car.userData.lateralOffset)
  car.position.set(frame.point.x + lateral.x, 0.7, frame.point.z + lateral.z)
  car.rotation.set(0, frame.angle, 0)
}

function restartRace() {
  state.speed = 0
  state.progress = 0
  state.place = 1
  state.raceFinished = false
  state.winner = null
  state.winnerTime = 0
  state.messageVisible = false
  state.collisionTimer = 0
  state.steerDirection = 0

  if (state.pendingLevelUp) {
    state.level = Math.min(state.level + 1, trackLevels.length)
    state.pendingLevelUp = false
    buildTrackGeometry(trackLevels[state.level - 1])
  }
  applyLevelToRivals(trackLevels[state.level - 1])

  playerCar.userData.t = 0
  playerCar.userData.lateralOffset = laneOffsets[1]
  placeCarOnTrack(playerCar)

  finishLine.flagMaterial.color.setHex(0xffffff)
  finishLine.flagMaterial.emissive.setHex(0x1f2937)

  rivals.forEach((rival) => {
    rival.userData.t = 0
    rival.userData.lateralOffset = laneOffsets[rival.userData.laneIndex]
    rival.userData.speed = 0
    placeCarOnTrack(rival)
  })

  state.raceStarted = false
  state.countdownStep = 3
  state.countdownStepTimer = 1
  countdownLabel.textContent = '3'
  countdownLabel.classList.remove('hidden', 'go')

  updateHud()
  setMessage('Finish Line', `Cuando termines, ${restartHint} para reiniciar la carrera.`, false)
  restartLevel1Button.classList.add('hidden')
  customizeVehicleButton.classList.add('hidden')
}

// Reinicia por completo el progreso: vuelve al nivel 1, reconstruye esa pista
// desde cero (ignorando cualquier subida de nivel pendiente) y arranca la
// cuenta regresiva de nuevo.
function restartFromLevelOne() {
  state.level = 1
  state.pendingLevelUp = false
  buildTrackGeometry(trackLevels[0])
  restartRace()
}

function updateCountdown(deltaTime) {
  state.countdownStepTimer -= deltaTime
  if (state.countdownStepTimer > 0) {
    return
  }

  state.countdownStep -= 1

  if (state.countdownStep > 0) {
    countdownLabel.textContent = String(state.countdownStep)
    state.countdownStepTimer = 1
  } else if (state.countdownStep === 0) {
    countdownLabel.textContent = '¡YA!'
    countdownLabel.classList.add('go')
    state.countdownStepTimer = 0.6
  } else {
    countdownLabel.classList.add('hidden')
    state.raceStarted = true
  }
}

function getProgressFor(car) {
  return THREE.MathUtils.clamp(car.userData.t, 0, 1)
}

function updatePlacings() {
  const orderedRacers = [...racers].sort((left, right) => getProgressFor(right) - getProgressFor(left))
  state.place = orderedRacers.findIndex((racer) => racer === playerCar) + 1
  state.progress = getProgressFor(playerCar)
}

function finishRace() {
  if (state.raceFinished) {
    return
  }
 
  const orderedRacers = [...racers].sort((left, right) => getProgressFor(right) - getProgressFor(left))
  state.winner = orderedRacers[0]
  state.place = orderedRacers.findIndex((racer) => racer === playerCar) + 1
  state.progress = 1
  state.raceFinished = true
  state.winnerTime = clock.elapsedTime
  finishLine.flagMaterial.color.setHex(state.winner.userData.color)
  finishLine.flagMaterial.emissive.setHex(state.winner.userData.color)
 
  const youWon = state.winner === playerCar
  const isLastLevel = state.level === trackLevels.length
 
  if (youWon && !isLastLevel) {
    state.pendingLevelUp = true
    restartLevel1Button.classList.add('hidden')
    customizeVehicleButton.classList.add('hidden')
    setMessage(
      `¡Nivel ${state.level} superado!`,
      `Terminaste primero/a. ${restartHint.charAt(0).toUpperCase() + restartHint.slice(1)} para pasar al nivel ${state.level + 1}, con curvas más cerradas y rivales más rápidos.`,
      true,
    )
  } else if (youWon) {
    restartLevel1Button.classList.remove('hidden')
    customizeVehicleButton.classList.remove('hidden')
    setMessage(
      '¡Circuito completo!',
      `Completaste los ${trackLevels.length} niveles. ${restartHint.charAt(0).toUpperCase() + restartHint.slice(1)} para repetir el nivel ${state.level}, o usa el botón de abajo para volver a empezar desde el nivel 1.`,
      true,
    )
  } else if (isLastLevel) {
    restartLevel1Button.classList.remove('hidden')
    customizeVehicleButton.classList.remove('hidden')
    setMessage(
      `${state.winner.userData.name} Gano!`,
      `Terminaste en el puesto ${state.place}. ${restartHint.charAt(0).toUpperCase() + restartHint.slice(1)} para repetir el nivel ${state.level}, o usa el botón de abajo para volver a empezar desde el nivel 1.`,
      true,
    )
  } else {
    restartLevel1Button.classList.add('hidden')
    customizeVehicleButton.classList.add('hidden')
    setMessage(
      `${state.winner.userData.name} Gano!`,
      `Terminaste en el puesto ${state.place}. La bandera ganadora ahora le pertenece a ${state.winner.userData.name}. ${restartHint.charAt(0).toUpperCase() + restartHint.slice(1)} para repetir el nivel ${state.level}.`,
      true,
    )
  }
 
  updateHud()
}

function handlePlayerCollision() {
  if (state.collisionTimer > 0 || state.raceFinished) {
    return
  }

  state.speed *= 0.62
  state.collisionTimer = 0.65
}

function updatePlayer(deltaTime) {
  if (state.raceFinished) {
    state.speed = Math.max(0, state.speed - 35 * deltaTime)
    return
  }

  if (input.accelerate) {
    state.speed += 37.5 * deltaTime
  } else {
    state.speed -= 13 * deltaTime
  }

  if (input.brake) {
    state.speed -= 57.5 * deltaTime
  }

  state.speed = THREE.MathUtils.clamp(state.speed, 0, state.maxSpeed)

  const steerInput = Number(input.right) - Number(input.left)
  state.steerDirection = THREE.MathUtils.lerp(state.steerDirection, steerInput, 6 * deltaTime)

  const steeringStrength = (4.8 + state.speed * 0.014) * deltaTime
  playerCar.userData.lateralOffset += steerInput * steeringStrength
  playerCar.userData.lateralOffset = THREE.MathUtils.clamp(
    playerCar.userData.lateralOffset,
    -roadWidth / 2 + 1.2,
    roadWidth / 2 - 1.2,
  )

  if (Math.abs(playerCar.userData.lateralOffset) > roadWidth / 2 - 2.3) {
    state.speed = Math.max(14, state.speed - 24 * deltaTime)
  }

  const distance = state.speed * deltaTime * 0.72
  playerCar.userData.t = Math.min(1, playerCar.userData.t + distance / curveLength)

  const frame = getCurveFrame(playerCar.userData.t)
  const lateral = frame.normal.clone().multiplyScalar(playerCar.userData.lateralOffset)
  playerCar.position.set(
    frame.point.x + lateral.x,
    0.7 + Math.sin(clock.elapsedTime * 10) * Math.min(state.speed / 110, 1) * 0.05,
    frame.point.z + lateral.z,
  )
  playerCar.rotation.y = frame.angle - state.steerDirection * 0.08
  playerCar.rotation.z = -state.steerDirection * 0.18
}

function updateRivals(deltaTime) {
  rivals.forEach((rival) => {
    const gapMeters = (playerCar.userData.t - rival.userData.t) * curveLength
    const catchUpBoost = gapMeters > 10 ? 6 : gapMeters < -18 ? -5 : 0
    const targetSpeed = THREE.MathUtils.clamp(
      rival.userData.cruiseSpeed + catchUpBoost,
      60,
      rival.userData.topSpeed,
    )

    const accelRate = 35
    if (rival.userData.speed < targetSpeed) {
      rival.userData.speed = Math.min(targetSpeed, rival.userData.speed + accelRate * deltaTime)
    } else {
      rival.userData.speed = Math.max(targetSpeed, rival.userData.speed - accelRate * deltaTime)
    }

    const distance = rival.userData.speed * deltaTime * 0.72
    rival.userData.t = Math.min(1, rival.userData.t + distance / curveLength)

    const laneTarget = laneOffsets[rival.userData.laneIndex]
    const wobble = Math.sin(clock.elapsedTime * 1.8 + rival.userData.wobbleSeed) * 0.5
    rival.userData.lateralOffset = THREE.MathUtils.lerp(
      rival.userData.lateralOffset,
      laneTarget + wobble,
      2.8 * deltaTime,
    )

    const frame = getCurveFrame(rival.userData.t)
    const lateral = frame.normal.clone().multiplyScalar(rival.userData.lateralOffset)
    rival.position.set(
      frame.point.x + lateral.x,
      0.7 + Math.sin(clock.elapsedTime * 7 + rival.userData.wobbleSeed) * 0.03,
      frame.point.z + lateral.z,
    )
    rival.rotation.y = frame.angle
    rival.rotation.z = Math.sin(clock.elapsedTime * 1.8 + rival.userData.wobbleSeed) * 0.03
  })
}

function updateCamera(deltaTime) {
  const frame = getCurveFrame(playerCar.userData.t)
  const behind = frame.tangent.clone().multiplyScalar(-11)
  const lean = frame.normal.clone().multiplyScalar(playerCar.userData.lateralOffset * 0.4)
  const targetPos = playerCar.position.clone().add(behind).add(lean)

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetPos.x, 8 * deltaTime)
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetPos.z, 8 * deltaTime)
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, playerCar.position.y + 5.8, 6 * deltaTime)

  const lookAtPos = playerCar.position.clone().add(frame.tangent.clone().multiplyScalar(20))
  camera.lookAt(lookAtPos.x, 1.8, lookAtPos.z)
}

function updateFlagAnimation() {
  const wave = Math.sin(clock.elapsedTime * 4.2) * 0.15
  finishLine.flag.rotation.y = wave
  finishLine.flag.position.y = 5.1 + Math.cos(clock.elapsedTime * 5) * 0.08
}

function checkPlayerCollisions() {
  rivals.forEach((rival) => {
    const arcDistance = Math.abs(rival.userData.t - playerCar.userData.t) * curveLength
    const lateralDiff = Math.abs(rival.userData.lateralOffset - playerCar.userData.lateralOffset)

    if (arcDistance < 3.4 && lateralDiff < 2) {
      handlePlayerCollision()
      const pushDirection = Math.sign(playerCar.userData.lateralOffset - rival.userData.lateralOffset) || 1
      playerCar.userData.lateralOffset += pushDirection * 0.08
    }
  })
}

function checkObstacleCollisions() {
  obstacles.forEach((obstacle) => {
    const arcDistance = Math.abs(obstacle.t - playerCar.userData.t) * curveLength
    const lateralDiff = Math.abs(obstacle.lateralOffset - playerCar.userData.lateralOffset)

    if (arcDistance < 2.6 && lateralDiff < 1.6) {
      handlePlayerCollision()
      // Empuja al jugador con mas fuerza que un choque con un rival, para que
      // se note claramente que golpeo un obstaculo fijo y no quede "pegado" a el.
      const pushDirection = Math.sign(playerCar.userData.lateralOffset - obstacle.lateralOffset) || 1
      playerCar.userData.lateralOffset = THREE.MathUtils.clamp(
        playerCar.userData.lateralOffset + pushDirection * 0.4,
        -roadWidth / 2 + 1.2,
        roadWidth / 2 - 1.2,
      )
    }
  })
}

function checkFinishLine() {
  if (racers.some((car) => car.userData.t >= 1)) {
    finishRace()
  }
}

function updateSunFollow() {
  sunLight.position.set(
    playerCar.position.x + sunOffset.x,
    sunOffset.y,
    playerCar.position.z + sunOffset.z,
  )
  sunLight.target.position.set(playerCar.position.x, 0, playerCar.position.z)
  sunLight.target.updateMatrixWorld()
}

function animate() {
  const deltaTime = Math.min(clock.getDelta(), 0.05)

  if (!state.raceStarted) {
    if (state.setupComplete) {
      updateCountdown(deltaTime)
    }
    updateCamera(deltaTime)
    updateFlagAnimation()
    updateSunFollow()
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
    window.requestAnimationFrame(animate)
    return
  }

  if (state.collisionTimer > 0) {
    state.collisionTimer -= deltaTime
  }

  updatePlayer(deltaTime)

  if (!state.raceFinished) {
    updateRivals(deltaTime)
    checkPlayerCollisions()
    checkObstacleCollisions()
    updatePlacings()
    checkFinishLine()
  }

  updateHud()
  updateFlagAnimation()

  updateCamera(deltaTime)
  updateSunFollow()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
  window.requestAnimationFrame(animate)
}

function handleKeyChange(event, isPressed) {
  if (!state.setupComplete) {
    return
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault()
  }

  switch (event.code) {
    case 'KeyA':
    case 'ArrowLeft':
      input.left = isPressed
      break
    case 'KeyD':
    case 'ArrowRight':
      input.right = isPressed
      break
    case 'KeyW':
    case 'ArrowUp':
      input.accelerate = isPressed
      break
    case 'KeyS':
    case 'ArrowDown':
      input.brake = isPressed
      break
    case 'KeyR':
      if (isPressed) {
        restartRace()
      }
      break
    default:
      break
  }
}

// Enlaza un boton tactil a un flag de `input`, sosteniendolo mientras el dedo
// esta sobre el boton (pointerdown/up/cancel/leave cubren los casos en los
// que el dedo se desliza fuera del boton sin soltarlo primero).
function bindHoldButton(button, setPressed) {
  if (!button) {
    return
  }

  const press = (event) => {
    event.preventDefault()
    if (!state.setupComplete) {
      return
    }
    setPressed(true)
  }
  const release = (event) => {
    event.preventDefault()
    setPressed(false)
  }

  button.addEventListener('pointerdown', press)
  button.addEventListener('pointerup', release)
  button.addEventListener('pointercancel', release)
  button.addEventListener('pointerleave', release)
  button.addEventListener('contextmenu', (event) => event.preventDefault())
}

bindHoldButton(touchLeftButton, (pressed) => {
  input.left = pressed
})
bindHoldButton(touchRightButton, (pressed) => {
  input.right = pressed
})
bindHoldButton(touchAccelerateButton, (pressed) => {
  input.accelerate = pressed
})
bindHoldButton(touchBrakeButton, (pressed) => {
  input.brake = pressed
})

if (touchRestartButton) {
  touchRestartButton.addEventListener(
    'click',
    (event) => {
      event.preventDefault()
      restartRace()
    },
    { passive: false },
  )
}

// En iOS/Android, cambiar de orientacion no siempre dispara 'resize' a
// tiempo (la barra de direccion del navegador todavia se esta animando),
// asi que se vuelve a medir un instante despues del evento.
window.addEventListener('orientationchange', () => {
  window.setTimeout(resizeRenderer, 250)
})

window.addEventListener('resize', resizeRenderer)
window.addEventListener('keydown', (event) => handleKeyChange(event, true))
window.addEventListener('keyup', (event) => handleKeyChange(event, false))
retryLevelButton.addEventListener('click', restartRace)
restartLevel1Button.addEventListener('click', restartFromLevelOne)
customizeVehicleButton.addEventListener('click', openCustomizeVehicle)

resizeRenderer()
restartRace()
animate()
