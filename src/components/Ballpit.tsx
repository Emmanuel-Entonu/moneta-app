import React, { useLayoutEffect, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  PointLight,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three'

// ─── Renderer / scene scaffolding ────────────────────────────────────────────

interface XCfg {
  canvas: HTMLCanvasElement
  rendererOptions?: Partial<WebGLRendererParameters>
}

interface SizeData {
  width: number; height: number; wWidth: number; wHeight: number
  ratio: number; pixelRatio: number
}

class ThreeApp {
  #resizeObserver?: ResizeObserver
  #intersectionObserver?: IntersectionObserver
  #resizeTimer?: number
  #frameId = 0
  #clock = new Clock()
  #elapsed = 0
  #animating = false
  #visible = false

  canvas: HTMLCanvasElement
  camera: PerspectiveCamera
  cameraFov: number
  cameraMaxAspect?: number
  scene: Scene
  renderer: WebGLRenderer
  size: SizeData = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 }
  isDisposed = false

  onBeforeRender: (s: { elapsed: number; delta: number }) => void = () => {}
  onAfterResize: (s: SizeData) => void = () => {}

  constructor(cfg: XCfg) {
    this.canvas = cfg.canvas
    this.canvas.style.display = 'block'
    this.camera = new PerspectiveCamera()
    this.cameraFov = this.camera.fov
    this.scene = new Scene()
    this.renderer = new WebGLRenderer({
      canvas: cfg.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      ...(cfg.rendererOptions ?? {}),
    })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.resize()
    this.#initObservers()
  }

  #initObservers() {
    if (this.canvas.parentNode) {
      this.#resizeObserver = new ResizeObserver(() => this.#debounce())
      this.#resizeObserver.observe(this.canvas.parentNode as Element)
    }
    this.#intersectionObserver = new IntersectionObserver(([e]) => {
      this.#animating = e.isIntersecting
      this.#animating ? this.#start() : this.#stop()
    }, { threshold: 0 })
    this.#intersectionObserver.observe(this.canvas)
    document.addEventListener('visibilitychange', () => {
      if (!this.#animating) return
      document.hidden ? this.#stop() : this.#start()
    })
  }

  #debounce() {
    if (this.#resizeTimer) clearTimeout(this.#resizeTimer)
    this.#resizeTimer = window.setTimeout(() => this.resize(), 100)
  }

  resize() {
    const p = this.canvas.parentNode as HTMLElement | null
    let w = p ? p.offsetWidth : window.innerWidth
    let h = p ? p.offsetHeight : window.innerHeight
    if (!w || !h) { w = window.innerWidth; h = window.innerHeight }
    this.size.width = w; this.size.height = h; this.size.ratio = w / h
    this.camera.aspect = w / h
    if (this.cameraMaxAspect && this.camera.aspect > this.cameraMaxAspect) {
      const t = Math.tan(MathUtils.degToRad(this.cameraFov / 2)) / (this.camera.aspect / this.cameraMaxAspect)
      this.camera.fov = 2 * MathUtils.radToDeg(Math.atan(t))
    } else {
      this.camera.fov = this.cameraFov
    }
    this.camera.updateProjectionMatrix()
    const fovR = (this.camera.fov * Math.PI) / 180
    this.size.wHeight = 2 * Math.tan(fovR / 2) * this.camera.position.length()
    this.size.wWidth = this.size.wHeight * this.camera.aspect
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.onAfterResize(this.size)
  }

  #start() {
    if (this.#visible) return
    this.#visible = true; this.#clock.start()
    const loop = () => {
      this.#frameId = requestAnimationFrame(loop)
      const delta = this.#clock.getDelta()
      this.#elapsed += delta
      this.onBeforeRender({ elapsed: this.#elapsed, delta })
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  #stop() {
    if (!this.#visible) return
    cancelAnimationFrame(this.#frameId); this.#visible = false; this.#clock.stop()
  }

  dispose() {
    this.#stop(); this.#resizeObserver?.disconnect(); this.#intersectionObserver?.disconnect()
    this.scene.clear(); this.renderer.dispose(); this.renderer.forceContextLoss()
    this.isDisposed = true
  }
}

// ─── Ball physics ─────────────────────────────────────────────────────────────

interface PhyCfg {
  count: number; maxX: number; maxY: number; maxZ: number
  maxSize: number; minSize: number; size0: number
  gravity: number; friction: number; wallBounce: number; maxVelocity: number
  controlSphere0?: boolean
}

class Physics {
  cfg: PhyCfg
  pos: Float32Array
  vel: Float32Array
  sizes: Float32Array
  center = new Vector3()

  constructor(cfg: PhyCfg) {
    this.cfg = cfg
    this.pos   = new Float32Array(3 * cfg.count)
    this.vel   = new Float32Array(3 * cfg.count)
    this.sizes = new Float32Array(cfg.count)
    for (let i = 1; i < cfg.count; i++) {
      const b = 3 * i
      this.pos[b]     = MathUtils.randFloatSpread(2 * cfg.maxX)
      this.pos[b + 1] = MathUtils.randFloatSpread(2 * cfg.maxY)
      this.pos[b + 2] = MathUtils.randFloatSpread(2 * cfg.maxZ)
    }
    this.sizes[0] = cfg.size0
    for (let i = 1; i < cfg.count; i++)
      this.sizes[i] = MathUtils.randFloat(cfg.minSize, cfg.maxSize)
  }

  update({ delta }: { delta: number }) {
    const { cfg: c, pos, vel, sizes, center } = this
    const start = c.controlSphere0 ? 1 : 0
    if (c.controlSphere0) {
      const p0 = new Vector3().fromArray(pos, 0).lerp(center, 0.1)
      p0.toArray(pos, 0); vel[0] = vel[1] = vel[2] = 0
    }
    for (let i = start; i < c.count; i++) {
      const b = 3 * i
      const p = new Vector3().fromArray(pos, b)
      const v = new Vector3().fromArray(vel, b)
      v.y -= delta * c.gravity * sizes[i]
      v.multiplyScalar(c.friction).clampLength(0, c.maxVelocity)
      p.add(v); p.toArray(pos, b); v.toArray(vel, b)
    }
    for (let i = start; i < c.count; i++) {
      const b = 3 * i
      const p = new Vector3().fromArray(pos, b)
      const v = new Vector3().fromArray(vel, b)
      const r = sizes[i]
      for (let j = i + 1; j < c.count; j++) {
        const ob = 3 * j
        const op = new Vector3().fromArray(pos, ob)
        const ov = new Vector3().fromArray(vel, ob)
        const diff = new Vector3().copy(op).sub(p)
        const dist = diff.length(), sr = r + sizes[j]
        if (dist < sr) {
          const corr = diff.normalize().multiplyScalar(0.5 * (sr - dist))
          p.sub(corr); v.sub(corr.clone().multiplyScalar(Math.max(v.length(), 1)))
          p.toArray(pos, b); v.toArray(vel, b)
          op.add(corr); ov.add(corr.clone().multiplyScalar(Math.max(ov.length(), 1)))
          op.toArray(pos, ob); ov.toArray(vel, ob)
        }
      }
      if (c.controlSphere0) {
        const diff = new Vector3().copy(new Vector3().fromArray(pos, 0)).sub(p)
        const d = diff.length(), sr0 = r + sizes[0]
        if (d < sr0) {
          const corr = diff.normalize().multiplyScalar(sr0 - d)
          p.sub(corr); v.sub(corr.clone().multiplyScalar(Math.max(v.length(), 2)))
        }
      }
      if (Math.abs(p.x) + r > c.maxX) { p.x = Math.sign(p.x) * (c.maxX - r); v.x = -v.x * c.wallBounce }
      if (c.gravity === 0) {
        if (Math.abs(p.y) + r > c.maxY) { p.y = Math.sign(p.y) * (c.maxY - r); v.y = -v.y * c.wallBounce }
      } else if (p.y - r < -c.maxY) { p.y = -c.maxY + r; v.y = -v.y * c.wallBounce }
      const mb = Math.max(c.maxZ, c.maxSize)
      if (Math.abs(p.z) + r > mb) { p.z = Math.sign(p.z) * (c.maxZ - r); v.z = -v.z * c.wallBounce }
      p.toArray(pos, b); v.toArray(vel, b)
    }
  }
}

// ─── Instanced balls ──────────────────────────────────────────────────────────

const defaultCfg = {
  count: 80,
  colors: [0x00d084, 0x6366f1, 0x34d399, 0x818cf8] as number[],
  minSize: 0.5, maxSize: 1.0, size0: 0,
  gravity: 0.5, friction: 0.9975, wallBounce: 0.95, maxVelocity: 0.15,
  maxX: 5, maxY: 5, maxZ: 2,
  controlSphere0: false, followCursor: false,
}

const dummy = new Object3D()

class Balls extends InstancedMesh {
  cfg: typeof defaultCfg
  physics: Physics

  constructor(params: Partial<typeof defaultCfg> = {}) {
    const cfg = { ...defaultCfg, ...params }
    super(new SphereGeometry(1, 24, 24), new MeshStandardMaterial({ roughness: 0.2, metalness: 0.05 }), cfg.count)
    this.cfg = cfg
    this.physics = new Physics(cfg)
    this.#applyColors(cfg.colors)
  }

  #applyColors(colors: number[]) {
    if (colors.length < 2) return
    const cols = colors.map(c => new Color(c))
    for (let i = 0; i < this.count; i++) {
      const t = i / this.count
      const s = t * (cols.length - 1), idx = Math.floor(s), a = s - idx
      const out = new Color()
      if (idx >= cols.length - 1) { out.copy(cols[idx]) }
      else {
        out.r = cols[idx].r + a * (cols[idx + 1].r - cols[idx].r)
        out.g = cols[idx].g + a * (cols[idx + 1].g - cols[idx].g)
        out.b = cols[idx].b + a * (cols[idx + 1].b - cols[idx].b)
      }
      this.setColorAt(i, out)
    }
    if (this.instanceColor) this.instanceColor.needsUpdate = true
  }

  tick(d: { delta: number }) {
    this.physics.update(d)
    for (let i = 0; i < this.count; i++) {
      dummy.position.fromArray(this.physics.pos, 3 * i)
      dummy.scale.setScalar(i === 0 && !this.cfg.followCursor ? 0 : this.physics.sizes[i])
      dummy.updateMatrix(); this.setMatrixAt(i, dummy.matrix)
    }
    this.instanceMatrix.needsUpdate = true
  }
}

// ─── Pointer tracking ─────────────────────────────────────────────────────────

const cursorPos = new Vector2()
let globalPtrActive = false
const ptrMap = new Map<HTMLElement, { nPos: Vector2; onMove: () => void; onLeave: () => void; dispose: () => void }>()

function trackPointer(el: HTMLElement, onMove: () => void, onLeave: () => void) {
  const nPos = new Vector2()
  const data = { nPos, onMove, onLeave, dispose: () => {} }
  ptrMap.set(el, data)

  const onPM = (e: PointerEvent) => {
    cursorPos.set(e.clientX, e.clientY)
    const rect = el.getBoundingClientRect()
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
    nPos.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    inside ? onMove() : onLeave()
  }
  const onPL = () => onLeave()

  if (!globalPtrActive) {
    document.body.addEventListener('pointermove', onPM as EventListener)
    document.body.addEventListener('pointerleave', onPL)
    globalPtrActive = true
  }

  data.dispose = () => {
    ptrMap.delete(el)
    if (ptrMap.size === 0) {
      document.body.removeEventListener('pointermove', onPM as EventListener)
      document.body.removeEventListener('pointerleave', onPL)
      globalPtrActive = false
    }
  }
  return data
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createBallpit(canvas: HTMLCanvasElement, params: Partial<typeof defaultCfg> = {}) {
  const cfg = { ...defaultCfg, ...params }
  const app = new ThreeApp({ canvas })
  app.camera.position.set(0, 0, 20)
  app.camera.lookAt(0, 0, 0)
  app.cameraMaxAspect = 1.5
  app.resize()

  const balls = new Balls(cfg)
  app.scene.add(
    new AmbientLight(0xffffff, 1.4),
    new HemisphereLight(0xffffff, 0x222244, 0.9),
    Object.assign(new DirectionalLight(0xffffff, 2), { position: new Vector3(5, 10, 7) }),
    Object.assign(new PointLight(0xffffff, 80), { position: new Vector3(-5, 5, 5) }),
    balls,
  )

  const raycaster = new Raycaster()
  const plane = new Plane(new Vector3(0, 0, 1), 0)
  const hit = new Vector3()

  const ptr = trackPointer(canvas,
    () => {
      raycaster.setFromCamera(ptr.nPos, app.camera)
      app.camera.getWorldDirection(plane.normal)
      raycaster.ray.intersectPlane(plane, hit)
      balls.physics.center.copy(hit)
      balls.cfg.controlSphere0 = true
    },
    () => { balls.cfg.controlSphere0 = false }
  )

  app.onBeforeRender = d => balls.tick(d)
  app.onAfterResize = s => {
    balls.cfg.maxX = s.wWidth / 2; balls.cfg.maxY = s.wHeight / 2
    balls.physics.cfg.maxX = s.wWidth / 2; balls.physics.cfg.maxY = s.wHeight / 2
  }

  return { app, dispose() { ptr.dispose(); app.dispose() } }
}

// ─── React component ──────────────────────────────────────────────────────────

interface BallpitProps {
  className?: string
  count?: number
  gravity?: number
  friction?: number
  wallBounce?: number
  followCursor?: boolean
  colors?: number[]
  [key: string]: any
}

const Ballpit: React.FC<BallpitProps> = ({ className = '', followCursor = false, ...props }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ref = useRef<ReturnType<typeof createBallpit> | null>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    ref.current = createBallpit(canvas, { followCursor, ...props })
    const rafId = requestAnimationFrame(() => ref.current?.app.resize())
    return () => { cancelAnimationFrame(rafId); ref.current?.dispose() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className={className} style={{ display: 'block', width: '100%', height: '100%' }} />
}

export default Ballpit
