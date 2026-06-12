'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

// ── Config ────────────────────────────────────────────────────────────────────
const SOURCE_FPS        = 30     // original video fps — controls autoplay pacing
const PARALLAX_STRENGTH = 0.065  // max UV pan offset (in 0..1 UV units)
const PARALLAX_LERP     = 0.06   // how quickly parallax responds to mouse
const ZOOM              = 1.12   // overscan so panning never reveals edges

// Fluid sim config
const SIM_RES        = 128
const VELOCITY_DISS  = 0.80
const PRESSURE_ITER  = 6
const CURL_AMOUNT    = 30
const SPLAT_RADIUS   = 0.12
const SPLAT_FORCE    = 2500
const DISP_STRENGTH  = 0.004

type Props = {
  frameCount?: number
  folderPath?: string
  extension?: string
}

// ── Double-buffered FBO ───────────────────────────────────────────────────────
interface FBO {
  texture: WebGLTexture
  fbo: WebGLFramebuffer
}

class DoubleFBO {
  read: FBO
  write: FBO
  constructor(gl: WebGLRenderingContext, w: number, h: number, halfFloat: number) {
    this.read  = DoubleFBO.makeFBO(gl, w, h, halfFloat)
    this.write = DoubleFBO.makeFBO(gl, w, h, halfFloat)
  }
  static makeFBO(gl: WebGLRenderingContext, w: number, h: number, type: number): FBO {
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.viewport(0, 0, w, h)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { texture, fbo }
  }
  swap() { const t = this.read; this.read = this.write; this.write = t }
}

class SingleFBO {
  texture: WebGLTexture
  fbo: WebGLFramebuffer
  constructor(gl: WebGLRenderingContext, w: number, h: number, halfFloat: number) {
    this.texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, halfFloat, null)
    this.fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
    gl.viewport(0, 0, w, h)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

function makeProgram(gl: WebGLRenderingContext, vert: string, frag: string) {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vert))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(prog)
  const uniforms: Record<string, WebGLUniformLocation> = {}
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i)!.name
    uniforms[name] = gl.getUniformLocation(prog, name)!
  }
  return { prog, uniforms }
}

// ── Shared vertex shader (full-screen quad, with neighbor UVs for fluid sim) ──
const BASE_VERT = `
  precision highp float;
  attribute vec2 aPos;
  varying vec2 vUv;
  varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform vec2 texelSize;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    vL  = vUv - vec2(texelSize.x, 0.0);
    vR  = vUv + vec2(texelSize.x, 0.0);
    vT  = vUv + vec2(0.0, texelSize.y);
    vB  = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`

// ── Fluid sim shaders ─────────────────────────────────────────────────────────
const SPLAT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec2 point;
  uniform vec2 velocity;
  uniform float radius;
  void main(){
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    float dist = exp(-dot(p,p) / radius);
    vec2 base = texture2D(uTarget, vUv).xy;
    gl_FragColor = vec4(base + velocity * dist, 0.0, 1.0);
  }`

const ADVECT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  void main(){
    vec2 vel = texture2D(uVelocity, vUv).xy;
    vec2 coord = vUv - dt * vel * texelSize;
    gl_FragColor = dissipation * texture2D(uSource, coord);
    gl_FragColor.a = 1.0;
  }`

const CURL_FRAG = `
  precision mediump float;
  varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uVelocity;
  void main(){
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
  }`

const VORTICITY_FRAG = `
  precision highp float;
  varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  void main(){
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 vel = texture2D(uVelocity, vUv).xy;
    gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
  }`

const DIVERGENCE_FRAG = `
  precision mediump float;
  varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uVelocity;
  void main(){
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
  }`

const PRESSURE_FRAG = `
  precision mediump float;
  varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  void main(){
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float div = texture2D(uDivergence, vUv).x;
    gl_FragColor = vec4((L + R + T + B - div) * 0.25, 0.0, 0.0, 1.0);
  }`

const GRAD_SUB_FRAG = `
  precision mediump float;
  varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  void main(){
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 vel = texture2D(uVelocity, vUv).xy;
    gl_FragColor = vec4(vel - vec2(R - L, T - B) * 0.5, 0.0, 1.0);
  }`

// ── Composite: video frame, UV-panned (parallax) + zoomed (overscan) + fluid-distorted ──
const COMPOSITE_VERT = `
  precision highp float;
  attribute vec2 aPos;
  varying vec2 vUv;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    vUv.y = 1.0 - vUv.y;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`

const COMPOSITE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tFrame;
  uniform sampler2D tVelocity;
  uniform float uDispStrength;
  uniform vec2 uPan;
  uniform float uZoom;
  void main(){
    vec2 vel = texture2D(tVelocity, vUv).xy;
    vec2 centered = (vUv - 0.5) / uZoom + 0.5;
    vec2 panned   = centered + uPan;
    vec2 uv = clamp(panned - vel * uDispStrength, 0.001, 0.999);
    gl_FragColor = texture2D(tFrame, uv);
  }`

export default function EntranceVideoExperience({
  frameCount = 447,
  folderPath = '/frames_entrance',
  extension  = 'png',
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)

  const glRef         = useRef<WebGLRenderingContext | null>(null)
  const frameTextures = useRef<(WebGLTexture | null)[]>([])
  const textureReady  = useRef<boolean[]>([])

  // Fluid sim FBOs
  const velocityRef   = useRef<DoubleFBO | null>(null)
  const pressureRef   = useRef<DoubleFBO | null>(null)
  const divergenceRef = useRef<SingleFBO | null>(null)
  const curlFBORef    = useRef<SingleFBO | null>(null)

  // Programs
  const progSplatRef     = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progAdvectRef    = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progCurlRef      = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progVorticityRef = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progDivRef       = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progPressureRef  = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progGradSubRef   = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progCompositeRef = useRef<ReturnType<typeof makeProgram> | null>(null)

  // Playback state
  const currentFrameRef = useRef(0)
  const startTimeRef    = useRef<number | null>(null)
  const finishedRef     = useRef(false)
  const readyToPlayRef  = useRef(false) // gated on loaded

  // Mouse / parallax
  const mouseNormRef = useRef({ x: 0.5, y: 0.5 })
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 })
  const parallaxRef  = useRef({ x: 0, y: 0 })

  const [loadPct, setLoadPct] = useState(0)
  const [loaded,  setLoaded ] = useState(false)

  // ── Blit helpers ────────────────────────────────────────────────────────────
  const blit = useCallback((targetFBO: WebGLFramebuffer | null, w: number, h: number) => {
    const gl = glRef.current!
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO)
    gl.viewport(0, 0, w, h)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }, [])

  const bindTex = useCallback((unit: number, tex: WebGLTexture) => {
    const gl = glRef.current!
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
  }, [])

  // ── Fluid step ──────────────────────────────────────────────────────────────
  const fluidStep = useCallback((dt: number) => {
    const gl       = glRef.current!
    const velocity = velocityRef.current!
    const pressure = pressureRef.current!
    const divFBO   = divergenceRef.current!
    const curlFBO  = curlFBORef.current!
    const S = SIM_RES

    gl.useProgram(progCurlRef.current!.prog)
    gl.uniform2f(progCurlRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, velocity.read.texture)
    gl.uniform1i(progCurlRef.current!.uniforms.uVelocity, 0)
    blit(curlFBO.fbo, S, S)

    gl.useProgram(progVorticityRef.current!.prog)
    gl.uniform2f(progVorticityRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, velocity.read.texture)
    gl.uniform1i(progVorticityRef.current!.uniforms.uVelocity, 0)
    bindTex(1, curlFBO.texture)
    gl.uniform1i(progVorticityRef.current!.uniforms.uCurl, 1)
    gl.uniform1f(progVorticityRef.current!.uniforms.curl, CURL_AMOUNT)
    gl.uniform1f(progVorticityRef.current!.uniforms.dt, dt)
    blit(velocity.write.fbo, S, S)
    velocity.swap()

    gl.useProgram(progDivRef.current!.prog)
    gl.uniform2f(progDivRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, velocity.read.texture)
    gl.uniform1i(progDivRef.current!.uniforms.uVelocity, 0)
    blit(divFBO.fbo, S, S)

    gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.read.fbo)
    gl.viewport(0, 0, S, S)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(progPressureRef.current!.prog)
    gl.uniform2f(progPressureRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(1, divFBO.texture)
    gl.uniform1i(progPressureRef.current!.uniforms.uDivergence, 1)
    for (let i = 0; i < PRESSURE_ITER; i++) {
      bindTex(0, pressure.read.texture)
      gl.uniform1i(progPressureRef.current!.uniforms.uPressure, 0)
      blit(pressure.write.fbo, S, S)
      pressure.swap()
    }

    gl.useProgram(progGradSubRef.current!.prog)
    gl.uniform2f(progGradSubRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, pressure.read.texture)
    gl.uniform1i(progGradSubRef.current!.uniforms.uPressure, 0)
    bindTex(1, velocity.read.texture)
    gl.uniform1i(progGradSubRef.current!.uniforms.uVelocity, 1)
    blit(velocity.write.fbo, S, S)
    velocity.swap()

    gl.useProgram(progAdvectRef.current!.prog)
    gl.uniform2f(progAdvectRef.current!.uniforms.texelSize, 1/S, 1/S)
    gl.uniform1f(progAdvectRef.current!.uniforms.dt, dt)
    gl.uniform1f(progAdvectRef.current!.uniforms.dissipation, VELOCITY_DISS)
    bindTex(0, velocity.read.texture)
    gl.uniform1i(progAdvectRef.current!.uniforms.uVelocity, 0)
    bindTex(1, velocity.read.texture)
    gl.uniform1i(progAdvectRef.current!.uniforms.uSource, 1)
    blit(velocity.write.fbo, S, S)
    velocity.swap()
  }, [blit, bindTex])

  // ── Splat mouse velocity into fluid ─────────────────────────────────────────
  const splat = useCallback((x: number, y: number, dx: number, dy: number) => {
    const gl = glRef.current!
    const velocity = velocityRef.current!
    const S = SIM_RES
    const aspect = gl.canvas.width / gl.canvas.height

    gl.useProgram(progSplatRef.current!.prog)
    gl.uniform2f(progSplatRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, velocity.read.texture)
    gl.uniform1i(progSplatRef.current!.uniforms.uTarget, 0)
    gl.uniform1f(progSplatRef.current!.uniforms.aspectRatio, aspect)
    gl.uniform2f(progSplatRef.current!.uniforms.point, x, y)
    gl.uniform2f(progSplatRef.current!.uniforms.velocity, dx * SPLAT_FORCE, dy * SPLAT_FORCE)
    gl.uniform1f(progSplatRef.current!.uniforms.radius, SPLAT_RADIUS / 100)
    blit(velocity.write.fbo, S, S)
    velocity.swap()
  }, [blit, bindTex])

  // ── WebGL init ──────────────────────────────────────────────────────────────
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
    }) as WebGLRenderingContext
    if (!gl) return
    glRef.current = gl

    const hfExt = gl.getExtension('OES_texture_half_float')
    gl.getExtension('OES_texture_half_float_linear')
    const halfFloat = hfExt ? hfExt.HALF_FLOAT_OES : gl.UNSIGNED_BYTE

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const initProg = (frag: string) => {
      const p = makeProgram(gl, BASE_VERT, frag)
      gl.useProgram(p.prog)
      const loc = gl.getAttribLocation(p.prog, 'aPos')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      return p
    }

    progSplatRef.current     = initProg(SPLAT_FRAG)
    progAdvectRef.current    = initProg(ADVECT_FRAG)
    progCurlRef.current      = initProg(CURL_FRAG)
    progVorticityRef.current = initProg(VORTICITY_FRAG)
    progDivRef.current       = initProg(DIVERGENCE_FRAG)
    progPressureRef.current  = initProg(PRESSURE_FRAG)
    progGradSubRef.current   = initProg(GRAD_SUB_FRAG)

    const comp = makeProgram(gl, COMPOSITE_VERT, COMPOSITE_FRAG)
    gl.useProgram(comp.prog)
    const compLoc = gl.getAttribLocation(comp.prog, 'aPos')
    gl.enableVertexAttribArray(compLoc)
    gl.vertexAttribPointer(compLoc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(comp.uniforms.uDispStrength, DISP_STRENGTH)
    gl.uniform1i(comp.uniforms.tFrame, 0)
    gl.uniform1i(comp.uniforms.tVelocity, 1)
    gl.uniform1f(comp.uniforms.uZoom, ZOOM)
    gl.uniform2f(comp.uniforms.uPan, 0, 0)
    progCompositeRef.current = comp

    const S = SIM_RES
    velocityRef.current   = new DoubleFBO(gl, S, S, halfFloat)
    pressureRef.current   = new DoubleFBO(gl, S, S, halfFloat)
    divergenceRef.current = new SingleFBO(gl, S, S, halfFloat)
    curlFBORef.current    = new SingleFBO(gl, S, S, halfFloat)

    frameTextures.current = Array.from({ length: frameCount }, () => {
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return t
    })
    textureReady.current = new Array(frameCount).fill(false)
  }, [frameCount])

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
    setLoaded(true)
    // Autoplay clock starts fresh from here — not before loading completes.
    startTimeRef.current = null
    readyToPlayRef.current = true
  }, [frameCount, folderPath, extension, uploadBitmap])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const gl     = glRef.current
    if (!canvas || !gl) return
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width  = window.innerWidth  * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width  = window.innerWidth  + 'px'
    canvas.style.height = window.innerHeight + 'px'
  }, [])

  // ── Render loop ─────────────────────────────────────────────────────────────
  const startRenderLoop = useCallback(() => {
    const gl = glRef.current
    if (!gl) return
    let running = true
    let lastT   = 0

    const paint = (t: number) => {
      if (!running) return
      const dt = Math.min((t - lastT) / 1000, 0.05)
      lastT = t

      // ── Autoplay timing — only once loading is fully done ──────────────────
      if (readyToPlayRef.current && !finishedRef.current) {
        if (startTimeRef.current === null) startTimeRef.current = t
        const elapsedSec = (t - startTimeRef.current) / 1000
        const frame = Math.floor(elapsedSec * SOURCE_FPS)
        if (frame >= frameCount - 1) {
          currentFrameRef.current = frameCount - 1
          finishedRef.current = true
        } else {
          currentFrameRef.current = frame
        }
      }

      // ── Fluid sim ────────────────────────────────────────────────────────────
      if (dt > 0) fluidStep(dt)

      // ── Parallax (UV pan, with zoom overscan) ───────────────────────────────
      const mx = mouseNormRef.current.x - 0.5
      const my = mouseNormRef.current.y - 0.5
      const targetX =  mx * PARALLAX_STRENGTH
      const targetY = -my * PARALLAX_STRENGTH
      parallaxRef.current.x += (targetX - parallaxRef.current.x) * PARALLAX_LERP
      parallaxRef.current.y += (targetY - parallaxRef.current.y) * PARALLAX_LERP

      // ── Composite ────────────────────────────────────────────────────────────
      const f = currentFrameRef.current
      if (textureReady.current[f] && velocityRef.current) {
        const comp = progCompositeRef.current!
        gl.useProgram(comp.prog)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.uniform2f(comp.uniforms.uPan, parallaxRef.current.x, parallaxRef.current.y)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, frameTextures.current[f])
        gl.uniform1i(comp.uniforms.tFrame, 0)

        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, velocityRef.current.read.texture)
        gl.uniform1i(comp.uniforms.tVelocity, 1)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }

      requestAnimationFrame(paint)
    }

    requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(paint) })
    return () => { running = false }
  }, [frameCount, fluidStep])

  // ── Mouse → parallax target + splat ────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top)  / rect.height
    const dx = nx - prevMouseRef.current.x
    const dy = ny - prevMouseRef.current.y
    prevMouseRef.current = { x: nx, y: ny }
    mouseNormRef.current = { x: nx, y: ny }
    if (Math.hypot(dx, dy) > 0.0005) {
      splat(nx, ny, dx, dy)
    }
  }, [splat])

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let stopRender: (() => void) | undefined

    const init = async () => {
      initWebGL()
      resizeCanvas()
      stopRender = startRenderLoop() ?? undefined
      await preloadFrames()
      window.addEventListener('resize',    resizeCanvas)
      window.addEventListener('mousemove', handleMouseMove)
    }

    init()

    return () => {
      stopRender?.()
      window.removeEventListener('resize',    resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      const gl = glRef.current
      if (gl) frameTextures.current.forEach(t => t && gl.deleteTexture(t))
    }
  }, [initWebGL, resizeCanvas, preloadFrames, startRenderLoop, handleMouseMove])

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {!loaded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: '#000',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '2rem'
        }}>
          <div style={{ width: '260px', height: '1px', background: 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0, background: '#fff',
              transformOrigin: 'left',
              transform: `scaleX(${loadPct / 100})`,
              transition: 'transform 0.3s ease'
            }} />
          </div>
          <p style={{
            fontFamily: '"Anton", sans-serif', fontSize: '0.75rem',
            letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)', margin: 0
          }}>
            {loadPct < 100 ? `Loading — ${loadPct}%` : 'Starting…'}
          </p>
        </div>
      )}
    </div>
  )
}