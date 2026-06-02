import { gsap } from 'gsap'
import { Observer } from 'gsap/Observer'
import React, { useLayoutEffect, useRef } from 'react'
import {
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

gsap.registerPlugin(Observer)

// ─── Three.js scaffolding ────────────────────────────────────────────────────

interface XConfig {
  canvas?: HTMLCanvasElement
  size?: 'parent' | { width: number; height: number }
  rendererOptions?: Partial<WebGLRendererParameters>
}

interface SizeData {
  width: number; height: number; wWidth: number; wHeight: number
  ratio: number; pixelRatio: number
}

class X {
  #config: XConfig
  #resizeObserver?: ResizeObserver
  #intersectionObserver?: IntersectionObserver
  #resizeTimer?: number
  #frameId = 0
  #clock = new Clock()
  #elapsed = 0
  #isAnimating = false
  #isVisible = false

  canvas!: HTMLCanvasElement
  camera!: PerspectiveCamera
  cameraFov!: number
  cameraMaxAspect?: number
  scene!: Scene
  renderer!: WebGLRenderer
  size: SizeData = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 }
  isDisposed = false

  onBeforeRender: (s: { elapsed: number; delta: number }) => void = () => {}
  onAfterResize: (s: SizeData) => void = () => {}

  constructor(config: XConfig) {
    this.#config = config
    this.camera = new PerspectiveCamera()
    this.cameraFov = this.camera.fov
    this.scene = new Scene()

    this.canvas = config.canvas!
    this.canvas.style.display = 'block'
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      ...(config.rendererOptions ?? {}),
    })
    this.renderer.outputColorSpace = SRGBColorSpace

    this.resize()
    this.#initObservers()
  }

  #initObservers() {
    if (this.#config.size !== 'parent') {
      window.addEventListener('resize', this.#debounceResize.bind(this))
    } else if (this.canvas.parentNode) {
      this.#resizeObserver = new ResizeObserver(this.#debounceResize.bind(this))
      this.#resizeObserver.observe(this.canvas.parentNode as Element)
    }
    this.#intersectionObserver = new IntersectionObserver(
      ([e]) => {
        this.#isAnimating = e.isIntersecting
        this.#isAnimating ? this.#start() : this.#stop()
      },
      { threshold: 0 }
    )
    this.#intersectionObserver.observe(this.canvas)
    document.addEventListener('visibilitychange', () => {
      if (!this.#isAnimating) return
      document.hidden ? this.#stop() : this.#start()
    })
  }

  #debounceResize() {
    if (this.#resizeTimer) clearTimeout(this.#resizeTimer)
    this.#resizeTimer = window.setTimeout(() => this.resize(), 100)
  }

  resize() {
    let w: number, h: number
    if (this.#config.size && typeof this.#config.size === 'object') {
      w = (this.#config.size as { width: number; height: number }).width
      h = (this.#config.size as { width: number; height: number }).height
    } else if (this.#config.size === 'parent' && this.canvas.parentNode) {
      const p = this.canvas.parentNode as HTMLElement
      w = p.offsetWidth; h = p.offsetHeight
    } else {
      w = window.innerWidth; h = window.innerHeight
    }
    if (!w || !h) { w = window.innerWidth; h = window.innerHeight }
    this.size.width = w; this.size.height = h; this.size.ratio = w / h
    this.camera.aspect = w / h
    if (this.cameraMaxAspect && this.camera.aspect > this.cameraMaxAspect) {
      const tan = Math.tan(MathUtils.degToRad(this.cameraFov / 2))
      const adj = tan / (this.camera.aspect / this.cameraMaxAspect)
      this.camera.fov = 2 * MathUtils.radToDeg(Math.atan(adj))
    } else {
      this.camera.fov = this.cameraFov
    }
    this.camera.updateProjectionMatrix()
    const fovR = (this.camera.fov * Math.PI) / 180
    this.size.wHeight = 2 * Math.tan(fovR / 2) * this.camera.position.length()
    this.size.wWidth = this.size.wHeight * this.camera.aspect
    this.renderer.setSize(w, h)
    const pr = Math.min(window.devicePixelRatio, 2)
    this.renderer.setPixelRatio(pr)
    this.size.pixelRatio = pr
    this.onAfterResize(this.size)
  }

  #start() {
    if (this.#isVisible) return
    this.#isVisible = true
    this.#clock.start()
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
    if (!this.#isVisible) return
    cancelAnimationFrame(this.#frameId)
    this.#isVisible = false
    this.#clock.stop()
  }

  dispose() {
    this.#stop()
    this.#resizeObserver?.disconnect()
    this.#intersectionObserver?.disconnect()
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.isDisposed = true
  }
}

// ─── Physics ─────────────────────────────────────────────────────────────────

interface PhysicsConfig {
  count: number; maxX: number; maxY: number; maxZ: number
  maxSize: number; minSize: number; size0: number
  gravity: number; friction: number; wallBounce: number; maxVelocity: number
  controlSphere0?: boolean
}

class Physics {
  config: PhysicsConfig
  pos: Float32Array
  vel: Float32Array
  sizes: Float32Array
  center = new Vector3()

  constructor(cfg: PhysicsConfig) {
    this.config = cfg
    this.pos = new Float32Array(3 * cfg.count)
    this.vel = new Float32Array(3 * cfg.count)
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
    const { config: c, pos, vel, sizes, center } = this
    const start = c.controlSphere0 ? 1 : 0
    if (c.controlSphere0) {
      const p0 = new Vector3().fromArray(pos, 0).lerp(center, 0.1)
      p0.toArray(pos, 0)
      vel[0] = vel[1] = vel[2] = 0
    }
    for (let i = start; i < c.count; i++) {
      const b = 3 * i
      const p = new Vector3().fromArray(pos, b)
      const v = new Vector3().fromArray(vel, b)
      v.y -= delta * c.gravity * sizes[i]
      v.multiplyScalar(c.friction).clampLength(0, c.maxVelocity)
      p.add(v)
      p.toArray(pos, b); v.toArray(vel, b)
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
        const dist = diff.length()
        const sr = r + sizes[j]
        if (dist < sr) {
          const overlap = sr - dist
          const corr = diff.normalize().multiplyScalar(0.5 * overlap)
          p.sub(corr); v.sub(corr.clone().multiplyScalar(Math.max(v.length(), 1)))
          p.toArray(pos, b); v.toArray(vel, b)
          op.add(corr); ov.add(corr.clone().multiplyScalar(Math.max(ov.length(), 1)))
          op.toArray(pos, ob); ov.toArray(vel, ob)
        }
      }
      if (c.controlSphere0) {
        const p0 = new Vector3().fromArray(pos, 0)
        const diff = new Vector3().copy(p0).sub(p)
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

// ─── Instanced ball mesh ──────────────────────────────────────────────────────

const defaultCfg = {
  count: 80,
  colors: [0x00d084, 0x6366f1, 0x34d399, 0x818cf8],
  minSize: 0.5, maxSize: 1.0, size0: 0,
  gravity: 0.5, friction: 0.9975, wallBounce: 0.95, maxVelocity: 0.15,
  maxX: 5, maxY: 5, maxZ: 2,
  controlSphere0: false, followCursor: false,
}

const dummy = new Object3D()

class Balls extends InstancedMesh {
  cfg: typeof defaultCfg
  physics: Physics
  light: PointLight

  constructor(params: Partial<typeof defaultCfg> = {}) {
    const cfg = { ...defaultCfg, ...params }
    const geo = new SphereGeometry(1, 20, 20)
    const mat = new MeshStandardMaterial({ roughness: 0.25, metalness: 0.05 })
    super(geo, mat, cfg.count)
    this.cfg = cfg
    this.physics = new Physics(cfg)
    this.light = new PointLight(0xffffff, 60)
    this.light.position.set(0, 3, 8)
    this.add(this.light)
    this.setColors(cfg.colors)
  }

  setColors(colors: number[]) {
    if (colors.length < 2) return
    const cols = colors.map(c => new Color(c))
    const lerp = (t: number) => {
      const s = Math.max(0, Math.min(1, t)) * (cols.length - 1)
      const i = Math.floor(s)
      if (i >= cols.length - 1) return cols[i].clone()
      const a = s - i
      const out = new Color()
      out.r = cols[i].r + a * (cols[i + 1].r - cols[i].r)
      out.g = cols[i].g + a * (cols[i + 1].g - cols[i].g)
      out.b = cols[i].b + a * (cols[i + 1].b - cols[i].b)
      return out
    }
    for (let i = 0; i < this.count; i++) this.setColorAt(i, lerp(i / this.count))
    if (this.instanceColor) this.instanceColor.needsUpdate = true
  }

  tick(delta: { delta: number }) {
    this.physics.update(delta)
    for (let i = 0; i < this.count; i++) {
      dummy.position.fromArray(this.physics.pos, 3 * i)
      dummy.scale.setScalar(i === 0 && !this.cfg.followCursor ? 0 : this.physics.sizes[i])
      dummy.updateMatrix()
      this.setMatrixAt(i, dummy.matrix)
    }
    this.instanceMatrix.needsUpdate = true
  }
}

// ─── Pointer tracking ─────────────────────────────────────────────────────────

let globalPointerActive = false
const cursorPos = new Vector2()
const pointerMap = new Map<HTMLElement, {
  pos: Vector2; nPos: Vector2; hover: boolean
  onMove: () => void; onLeave: () => void; dispose: () => void
}>()

function trackPointer(el: HTMLElement, onMove: () => void, onLeave: () => void) {
  const data = { pos: new Vector2(), nPos: new Vector2(), hover: false, onMove, onLeave, dispose: () => {} }
  pointerMap.set(el, data)

  function move(cx: number, cy: number) {
    cursorPos.set(cx, cy)
    const rect = el.getBoundingClientRect()
    const inside = cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom
    data.pos.set(cx - rect.left, cy - rect.top)
    data.nPos.set((data.pos.x / rect.width) * 2 - 1, -(data.pos.y / rect.height) * 2 + 1)
    if (inside && !data.hover) { data.hover = true }
    else if (!inside && data.hover) { data.hover = false; onLeave() }
    if (data.hover) onMove()
  }

  const onPM = (e: PointerEvent) => move(e.clientX, e.clientY)
  const onPL = () => { if (data.hover) { data.hover = false; onLeave() } }

  if (!globalPointerActive) {
    document.body.addEventListener('pointermove', onPM as EventListener)
    document.body.addEventListener('pointerleave', onPL)
    globalPointerActive = true
  }

  data.dispose = () => {
    pointerMap.delete(el)
    if (pointerMap.size === 0) {
      document.body.removeEventListener('pointermove', onPM as EventListener)
      document.body.removeEventListener('pointerleave', onPL)
      globalPointerActive = false
    }
  }
  return data
}

// ─── Main factory ─────────────────────────────────────────────────────────────

function createBallpit(canvas: HTMLCanvasElement, params: Partial<typeof defaultCfg> = {}) {
  const cfg = { ...defaultCfg, ...params }

  const three = new X({ canvas, size: 'parent', rendererOptions: { alpha: true } })
  three.camera.position.set(0, 0, 20)
  three.camera.lookAt(0, 0, 0)
  three.cameraMaxAspect = 1.5

  // Force resize now that camera is positioned
  three.resize()

  const balls = new Balls(cfg)
  const ambient = new AmbientLight(0xffffff, 1.2)
  const hemi = new HemisphereLight(0xffffff, 0x444444, 0.8)
  const dir = new DirectionalLight(0xffffff, 1.5)
  dir.position.set(5, 10, 7)
  three.scene.add(ambient, hemi, dir, balls)

  const raycaster = new Raycaster()
  const plane = new Plane(new Vector3(0, 0, 1), 0)
  const hit = new Vector3()

  const ptr = trackPointer(
    canvas,
    () => {
      raycaster.setFromCamera(ptr.nPos, three.camera)
      three.camera.getWorldDirection(plane.normal)
      raycaster.ray.intersectPlane(plane, hit)
      balls.physics.center.copy(hit)
      balls.cfg.controlSphere0 = true
    },
    () => { balls.cfg.controlSphere0 = false }
  )

  three.onBeforeRender = d => balls.tick(d)
  three.onAfterResize = s => {
    balls.cfg.maxX = s.wWidth / 2
    balls.cfg.maxY = s.wHeight / 2
    balls.physics.config.maxX = s.wWidth / 2
    balls.physics.config.maxY = s.wHeight / 2
  }

  return {
    three,
    dispose() { ptr.dispose(); three.dispose() },
  }
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
  const instanceRef = useRef<ReturnType<typeof createBallpit> | null>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    instanceRef.current = createBallpit(canvas, { followCursor, ...props })
    // Second resize in next frame ensures IntersectionObserver fires with correct size
    const rafId = requestAnimationFrame(() => instanceRef.current?.three.resize())
    return () => { cancelAnimationFrame(rafId); instanceRef.current?.dispose() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}

export default Ballpit
