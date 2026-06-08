'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type Lenis from '@studio-freight/lenis'

gsap.registerPlugin(SplitText)

type Props = {
  frameCount: number
  folderPath?: string
  extension?: string
}

const PX_PER_FRAME      = 12
const DISP_SIZE         = 256
const DECAY             = 0.018
const BASE_RADIUS       = 8
const MAX_RADIUS        = 18
const PARALLAX_STRENGTH = 18
// How fast the invisible blob chases the cursor (0 = never, 1 = instant)
const BLOB_LERP         = 0.06

export default function VideoScrollExperience({
  frameCount = 121,
  folderPath = '/frames',
  extension  = 'webp',
}: Props) {
  const wrapperRef     = useRef<HTMLDivElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const lenisRef       = useRef<Lenis | null>(null)
  const line1Ref       = useRef<HTMLDivElement>(null)
  const line2Ref       = useRef<HTMLDivElement>(null)
  const checkpointWrap = useRef<HTMLDivElement>(null)

  const glRef         = useRef<WebGLRenderingContext | null>(null)
  const dispTexRef    = useRef<WebGLTexture | null>(null)
  const uStrengthRef  = useRef<WebGLUniformLocation | null>(null)
  const frameTextures = useRef<(WebGLTexture | null)[]>([])
  const textureReady  = useRef<boolean[]>([])

  const dispBufRef   = useRef<Float32Array | null>(null)
  const dispU8Ref    = useRef<Uint8ClampedArray | null>(null)
  const dispDirtyRef = useRef(false)

  const targetFrameRef  = useRef(0)
  const displayFrameRef = useRef(0)
  const isReadyRef      = useRef(false)

  const animatingRef = useRef(false)
  const directionRef = useRef(1)
  const progressRef  = useRef(0)

  const checkpointShownRef = useRef(false)
  const checkpointTlRef    = useRef<gsap.core.Timeline | null>(null)
  const split1Ref          = useRef<SplitText | null>(null)
  const split2Ref          = useRef<SplitText | null>(null)

  const mouseNormRef = useRef({ x: 0.5, y: 0.5 })  // actual cursor
  const blobRef      = useRef({ x: 0.5, y: 0.5 })  // lagging blob position
  const parallaxRef  = useRef({ x: 0, y: 0 })

  const [loadPct, setLoadPct] = useState(0)
  const [loaded,  setLoaded ] = useState(false)

  // ── Displacement ─────────────────────────────────────────────────────────────

  const initBuf = useCallback(() => {
    const n = DISP_SIZE * DISP_SIZE
    const f = new Float32Array(n * 2); f.fill(128)
    dispBufRef.current = f
    const u = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n * 4; i += 4) { u[i] = u[i+1] = 128; u[i+2] = 128; u[i+3] = 255 }
    dispU8Ref.current = u
    dispDirtyRef.current = true
  }, [])

  const decayAndQuantise = useCallback(() => {
    const f = dispBufRef.current, u = dispU8Ref.current
    if (!f || !u) return
    let dirty = false
    const n = DISP_SIZE * DISP_SIZE
    for (let i = 0, j = 0; i < n; i++, j += 2) {
      const dr = f[j] - 128, dg = f[j+1] - 128
      if (Math.abs(dr) < 0.4 && Math.abs(dg) < 0.4) { f[j] = f[j+1] = 128; continue }
      dirty = true
      f[j]   = 128 + dr * (1 - DECAY)
      f[j+1] = 128 + dg * (1 - DECAY)
      const ui = i * 4
      u[ui]   = (f[j]   + 0.5) | 0
      u[ui+1] = (f[j+1] + 0.5) | 0
    }
    if (dirty) dispDirtyRef.current = true
  }, [])

  const paintCurl = useCallback((cx: number, cy: number, radius: number, vx: number, vy: number, strength: number) => {
    const f = dispBufRef.current, u = dispU8Ref.current
    if (!f || !u) return
    const S = DISP_SIZE
    const speed = Math.hypot(vx, vy)
    if (speed < 0.1 && strength < 0.05) return
    const inv = 1 / Math.max(speed, 0.001)
    const nx = vx * inv, ny = vy * inv
    const x0 = Math.max(0, (cx - radius)|0), x1 = Math.min(S-1, (cx+radius+1)|0)
    const y0 = Math.max(0, (cy - radius)|0), y1 = Math.min(S-1, (cy+radius+1)|0)
    const r2 = radius * radius
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px-cx, dy = py-cy
        if (dx*dx+dy*dy > r2) continue
        const t = 1 - Math.sqrt(dx*dx+dy*dy)/radius
        const w = t*t*(3-2*t)*strength
        const fR = nx*85*w, fG = ny*85*w
        const cw = (1-t)*t*4.5*w
        const cR = -ny*55*cw, cG = nx*55*cw
        const j = (py*S+px)*2
        f[j]   = Math.max(0, Math.min(255, f[j]   + fR + cR))
        f[j+1] = Math.max(0, Math.min(255, f[j+1] + fG + cG))
        const ui = (py*S+px)*4
        u[ui]   = (f[j]   + 0.5)|0
        u[ui+1] = (f[j+1] + 0.5)|0
      }
    }
    dispDirtyRef.current = true
  }, [])

  // ── WebGL ─────────────────────────────────────────────────────────────────────

  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false }) as WebGLRenderingContext
    if (!gl) return
    glRef.current = gl

    const vert = `
      attribute vec2 p;
      varying vec2 v;
      uniform vec2 uPan;
      void main(){
        v = vec2(p.x*.5+.5, .5-p.y*.5);
        gl_Position = vec4(p + uPan, 0.0, 1.0);
      }`

    const frag = `
      precision mediump float;
      uniform sampler2D tF, tD;
      uniform float uS;
      varying vec2 v;
      void main(){
        vec2 px = vec2(5.0 / 256.0);
        vec2 d = vec2(0.0);
        d += (texture2D(tD, v).rg                             - 0.5) * 0.25;
        d += (texture2D(tD, v + vec2( px.x,  0.0)).rg         - 0.5) * 0.12;
        d += (texture2D(tD, v + vec2(-px.x,  0.0)).rg         - 0.5) * 0.12;
        d += (texture2D(tD, v + vec2( 0.0,  px.y)).rg         - 0.5) * 0.12;
        d += (texture2D(tD, v + vec2( 0.0, -px.y)).rg         - 0.5) * 0.12;
        d += (texture2D(tD, v + vec2( px.x,  px.y)).rg        - 0.5) * 0.065;
        d += (texture2D(tD, v + vec2(-px.x,  px.y)).rg        - 0.5) * 0.065;
        d += (texture2D(tD, v + vec2( px.x, -px.y)).rg        - 0.5) * 0.065;
        d += (texture2D(tD, v + vec2(-px.x, -px.y)).rg        - 0.5) * 0.065;
        d *= uS * 3.5;
        gl_FragColor = texture2D(tF, clamp(v + d, 0.001, 0.999));
      }`

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s); return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER,   vert))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(prog); gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    uStrengthRef.current = gl.getUniformLocation(prog, 'uS')
    ;(glRef as any)._uPan = gl.getUniformLocation(prog, 'uPan')
    gl.uniform1f(uStrengthRef.current, 0.038)
    gl.uniform2f((glRef as any)._uPan, 0, 0)
    gl.uniform1i(gl.getUniformLocation(prog, 'tF'), 0)
    gl.uniform1i(gl.getUniformLocation(prog, 'tD'), 1)

    frameTextures.current = Array.from({ length: frameCount }, () => {
      gl.activeTexture(gl.TEXTURE0)
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return t
    })
    textureReady.current = new Array(frameCount).fill(false)

    gl.activeTexture(gl.TEXTURE1)
    const dt = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, dt)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    dispTexRef.current = dt
    initBuf()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, DISP_SIZE, DISP_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, dispU8Ref.current)
  }, [frameCount, initBuf])

  // ── Frame loading ─────────────────────────────────────────────────────────────

  const uploadBitmap = useCallback((bitmap: ImageBitmap, i: number) => {
    const gl = glRef.current
    if (!gl) return
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, frameTextures.current[i])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
    textureReady.current[i] = true
    bitmap.close()
  }, [])

  const preloadFrames = useCallback(async () => {
    let done = 0
    const loadOne = async (i: number) => {
      const n = (i + 1).toString().padStart(4, '0')
      try {
        const resp   = await fetch(`${folderPath}/frame_${n}.${extension}`)
        const blob   = await resp.blob()
        const bitmap = await createImageBitmap(blob, { resizeQuality: 'high' })
        if (glRef.current) uploadBitmap(bitmap, i)
      } catch { /* skip */ }
      done++
      setLoadPct(Math.round((done / frameCount) * 100))
    }
    const BATCH = 12
    for (let i = 0; i < frameCount; i += BATCH) {
      await Promise.all(
        Array.from({ length: Math.min(BATCH, frameCount - i) }, (_, k) => loadOne(i + k))
      )
    }
    isReadyRef.current = true
    setLoaded(true)
  }, [frameCount, folderPath, extension, uploadBitmap])

  // ── Canvas resize ─────────────────────────────────────────────────────────────

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current, gl = glRef.current
    if (!canvas || !gl) return
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width  = window.innerWidth  * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width  = window.innerWidth  + 'px'
    canvas.style.height = window.innerHeight + 'px'
    gl.viewport(0, 0, canvas.width, canvas.height)
  }, [])

  // ── Checkpoint reveal / hide ──────────────────────────────────────────────────

  const revealCheckpoint = useCallback(() => {
    if (checkpointShownRef.current) return
    checkpointShownRef.current = true

    const wrap = checkpointWrap.current
    const l1   = line1Ref.current
    const l2   = line2Ref.current
    if (!wrap || !l1 || !l2) return

    checkpointTlRef.current?.kill()
    split1Ref.current?.revert()
    split2Ref.current?.revert()

    const s1 = new SplitText(l1, { type: 'chars' })
    const s2 = new SplitText(l2, { type: 'chars' })
    split1Ref.current = s1
    split2Ref.current = s2

    const allChars = [...s1.chars, ...s2.chars] as HTMLElement[]
    allChars.forEach(ch => {
      ch.style.display    = 'inline-block'
      ch.style.opacity    = '0'
      ch.style.filter     = 'blur(20px)'
      ch.style.transform  = 'translateY(-30px)'
      ch.style.color      = '#ffffff'
      ch.style.willChange = 'filter, opacity, transform'
    })

    gsap.set(wrap, { visibility: 'visible', opacity: 1 })

    const tl = gsap.timeline()
    checkpointTlRef.current = tl

    tl.to(s1.chars as HTMLElement[], {
      opacity: 1, filter: 'blur(0px)', y: 0,
      duration: 1.2, ease: 'power3.out',
      stagger: { each: 0.05, from: 'start' },
    }, 0)

    tl.to(s2.chars as HTMLElement[], {
      opacity: 1, filter: 'blur(0px)', y: 0,
      duration: 1.2, ease: 'power3.out',
      stagger: { each: 0.05, from: 'start' },
    }, 0.25)
  }, [])

  const hideCheckpoint = useCallback(() => {
    if (!checkpointShownRef.current) return
    checkpointShownRef.current = false

    const wrap = checkpointWrap.current
    if (!wrap) return

    checkpointTlRef.current?.kill()
    gsap.to(wrap, {
      opacity: 0, y: -20, filter: 'blur(14px)',
      duration: 0.5, ease: 'power2.in',
      onComplete: () => {
        gsap.set(wrap, { visibility: 'hidden', y: 0, filter: 'blur(0px)' })
        split1Ref.current?.revert()
        split2Ref.current?.revert()
      }
    })
  }, [])

  // ── Render loop — blob lerps toward cursor each frame, paints there ───────────

  const startRenderLoop = useCallback(() => {
    const gl = glRef.current
    if (!gl) return
    let running = true

    const paint = () => {
      if (!running) return

      displayFrameRef.current = targetFrameRef.current
      const frameIdx = Math.max(0, Math.min(frameCount - 1, Math.round(displayFrameRef.current)))

      if (frameIdx === frameCount - 1 && !checkpointShownRef.current) {
        revealCheckpoint()
      }

      // ── Blob chases cursor with lag ──────────────────────────────────────────
      const prevBx = blobRef.current.x
      const prevBy = blobRef.current.y
      blobRef.current.x += (mouseNormRef.current.x - blobRef.current.x) * BLOB_LERP
      blobRef.current.y += (mouseNormRef.current.y - blobRef.current.y) * BLOB_LERP

      // Velocity of the blob itself (not the cursor)
      const bvx = (blobRef.current.x - prevBx) * 60 * 55
      const bvy = (blobRef.current.y - prevBy) * 60 * 55
      const bSpeed = Math.hypot(bvx, bvy)

      if (bSpeed > 0.2) {
        const radius   = BASE_RADIUS + Math.min(bSpeed * 0.2, MAX_RADIUS - BASE_RADIUS)
        const strength = Math.min(0.5 + bSpeed * 0.02, 2.2)
        paintCurl(
          blobRef.current.x * DISP_SIZE,
          blobRef.current.y * DISP_SIZE,
          radius, bvx, bvy, strength
        )
      }

      // ── Parallax ─────────────────────────────────────────────────────────────
      const mx = mouseNormRef.current.x - 0.5
      const my = mouseNormRef.current.y - 0.5
      parallaxRef.current.x += (mx * PARALLAX_STRENGTH - parallaxRef.current.x) * 0.04
      parallaxRef.current.y += (my * PARALLAX_STRENGTH - parallaxRef.current.y) * 0.04
      const panX =  (parallaxRef.current.x / window.innerWidth)  * 2
      const panY = -(parallaxRef.current.y / window.innerHeight) * 2
      gl.uniform2f((glRef as any)._uPan, panX, panY)

      // ── Displacement texture upload ───────────────────────────────────────────
      decayAndQuantise()
      if (dispDirtyRef.current && dispU8Ref.current) {
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, dispTexRef.current)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, DISP_SIZE, DISP_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, dispU8Ref.current)
        dispDirtyRef.current = false
      }

      if (textureReady.current[frameIdx]) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, frameTextures.current[frameIdx])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }

      requestAnimationFrame(paint)
    }
    requestAnimationFrame(paint)
    return () => { running = false }
  }, [frameCount, decayAndQuantise, revealCheckpoint, paintCurl])

  // ── Scroll ────────────────────────────────────────────────────────────────────

  const handleScroll = useCallback(({ direction }: { scroll: number; direction: number }) => {
    if (!isReadyRef.current) return

    if (direction === -1 && checkpointShownRef.current) {
      hideCheckpoint()
    }

    directionRef.current = direction
    if (animatingRef.current) return
    animatingRef.current = true

    const duration  = 1800
    const frameStep = (1 / 60) / (duration / 1000)

    const animate = () => {
      progressRef.current += directionRef.current * frameStep

      if (progressRef.current <= 0) {
        progressRef.current = 0
        targetFrameRef.current = 0
        animatingRef.current = false
        return
      }
      if (progressRef.current >= 1) {
        progressRef.current = 1
        targetFrameRef.current = frameCount - 1
        animatingRef.current = false
        return
      }

      const p = progressRef.current
      const eased = p < 0.5
        ? 4 * p * p * p
        : 1 - Math.pow(-2 * p + 2, 3) / 2

      targetFrameRef.current = eased * (frameCount - 1)
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [frameCount, hideCheckpoint])

  // ── Mouse — just updates cursor position, no painting here ───────────────────

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseNormRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top)  / rect.height,
    }
  }, [])

  // ── Bootstrap ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let lenis: Lenis | undefined
    let stopRender: (() => void) | undefined

    const init = async () => {
      initWebGL()
      resizeCanvas()
      stopRender = startRenderLoop() ?? undefined
      await preloadFrames()

      const { default: Lenis } = await import('@studio-freight/lenis')
      lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 1 })
      lenisRef.current = lenis
      lenis.on('scroll', handleScroll)

      const raf = (t: number) => { lenis?.raf(t); requestAnimationFrame(raf) }
      requestAnimationFrame(raf)

      window.addEventListener('resize',    resizeCanvas)
      window.addEventListener('mousemove', handleMouseMove)
    }

    init()

    return () => {
      lenis?.destroy()
      stopRender?.()
      window.removeEventListener('resize',    resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      const gl = glRef.current
      if (gl) frameTextures.current.forEach(t => t && gl.deleteTexture(t))
    }
  }, [initWebGL, resizeCanvas, preloadFrames, startRenderLoop, handleScroll, handleMouseMove])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        .checkpoint-line {
          font-family: 'Anton', sans-serif;
          font-size: clamp(2.8rem, 8vw, 6rem);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #ffffff;
          line-height: 1.1;
          display: block;
        }
      `}</style>

      <div style={{ height: `calc(${frameCount * PX_PER_FRAME}px + 100vh)`, position: 'relative' }}>

        {/* WebGL canvas */}
        <div
          ref={wrapperRef}
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}
        >
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* Checkpoint — separate layer above canvas */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
          <div
            ref={checkpointWrap}
            style={{
              position: 'absolute',
              top: '20%',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              visibility: 'hidden',
              opacity: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.1em',
            }}
          >
            <div ref={line1Ref} className="checkpoint-line">Checkpoint One</div>
            <div ref={line2Ref} className="checkpoint-line">Complete</div>
          </div>
        </div>

        {/* Loader */}
        {!loaded && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
            <div style={{ width: '260px', height: '1px', background: 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: '#fff', transformOrigin: 'left', transform: `scaleX(${loadPct / 100})`, transition: 'transform 0.3s ease' }} />
            </div>
            <p style={{ fontFamily: '"Anton", sans-serif', fontSize: '0.75rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {loadPct < 100 ? `Loading — ${loadPct}%` : 'Starting…'}
            </p>
          </div>
        )}

      </div>
    </>
  )
}