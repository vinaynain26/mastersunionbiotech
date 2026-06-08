'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type Lenis from '@studio-freight/lenis'

gsap.registerPlugin(SplitText)

// ── Config ────────────────────────────────────────────────────────────────────
const PX_PER_FRAME    = 12
const PARALLAX_STRENGTH = 18

// Fluid sim config
const SIM_RES        = 128   // velocity field resolution
const VELOCITY_DISS  = 0.80  // low = snaps back very fast
const PRESSURE_ITER  = 6     // fewer = faster, less lingering
const CURL_AMOUNT    = 30    // vorticity — higher = more swirl
const SPLAT_RADIUS   = 0.12  // splat footprint in UV space
const SPLAT_FORCE    = 2500  // velocity injected per mouse delta
const DISP_STRENGTH  = 0.004 // how much velocity warps the image UVs

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
  constructor(
    private gl: WebGLRenderingContext,
    w: number, h: number,
    halfFloat: number
  ) {
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

// ── Shader compiler ───────────────────────────────────────────────────────────
function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

function makeProgram(gl: WebGLRenderingContext, vert: string, frag: string) {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vert))
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(prog)
  const uniforms: Record<string, WebGLUniformLocation> = {}
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i)!.name
    uniforms[name] = gl.getUniformLocation(prog, name)!
  }
  return { prog, uniforms }
}

// ── Shared vertex shader (full-screen quad) ───────────────────────────────────
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

// ── Fragment shaders ──────────────────────────────────────────────────────────
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

// Final composite: sample video frame distorted by fluid velocity
const COMPOSITE_VERT = `
  precision highp float;
  attribute vec2 aPos;
  varying vec2 vUv;
  uniform vec2 uPan;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    // flip Y so frame images render right-side up
    vUv.y = 1.0 - vUv.y;
    gl_Position = vec4(aPos + uPan, 0.0, 1.0);
  }`

const COMPOSITE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tFrame;
  uniform sampler2D tVelocity;
  uniform float uDispStrength;
  void main(){
    vec2 vel = texture2D(tVelocity, vUv).xy;
    // negate so image pulls toward cursor rather than away
    vec2 uv = clamp(vUv - vel * uDispStrength, 0.001, 0.999);
    gl_FragColor = texture2D(tFrame, uv);
  }`

// ── Component ─────────────────────────────────────────────────────────────────
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

  // WebGL core
  const glRef          = useRef<WebGLRenderingContext | null>(null)
  const halfFloatRef   = useRef<number>(0)
  const frameTextures  = useRef<(WebGLTexture | null)[]>([])
  const textureReady   = useRef<boolean[]>([])

  // Fluid sim FBOs
  const velocityRef    = useRef<DoubleFBO | null>(null)
  const pressureRef    = useRef<DoubleFBO | null>(null)
  const divergenceRef  = useRef<SingleFBO | null>(null)
  const curlFBORef     = useRef<SingleFBO | null>(null)

  // Programs
  const progSplatRef      = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progAdvectRef     = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progCurlRef       = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progVorticityRef  = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progDivRef        = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progPressureRef   = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progGradSubRef    = useRef<ReturnType<typeof makeProgram> | null>(null)
  const progCompositeRef  = useRef<ReturnType<typeof makeProgram> | null>(null)

  // Scroll state
  const targetFrameRef   = useRef(0)
  const isReadyRef       = useRef(false)
  const animatingRef     = useRef(false)
  const directionRef     = useRef(1)
  const progressRef      = useRef(0)

  // Checkpoint
  const checkpointShownRef = useRef(false)
  const checkpointTlRef    = useRef<gsap.core.Timeline | null>(null)
  const split1Ref          = useRef<SplitText | null>(null)
  const split2Ref          = useRef<SplitText | null>(null)

  // Mouse / parallax
  const mouseNormRef  = useRef({ x: 0.5, y: 0.5 })
  const prevMouseRef  = useRef({ x: 0.5, y: 0.5 })
  const parallaxRef   = useRef({ x: 0, y: 0 })

  const [loadPct, setLoadPct] = useState(0)
  const [loaded,  setLoaded ] = useState(false)

  // ── Blit helper ──────────────────────────────────────────────────────────────
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

  // ── Fluid step ────────────────────────────────────────────────────────────────
  const fluidStep = useCallback((dt: number) => {
    const gl       = glRef.current!
    const velocity = velocityRef.current!
    const pressure = pressureRef.current!
    const divFBO   = divergenceRef.current!
    const curlFBO  = curlFBORef.current!
    const S = SIM_RES

    // 1. Curl
    gl.useProgram(progCurlRef.current!.prog)
    gl.uniform2f(progCurlRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, velocity.read.texture)
    gl.uniform1i(progCurlRef.current!.uniforms.uVelocity, 0)
    blit(curlFBO.fbo, S, S)

    // 2. Vorticity confinement
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

    // 3. Divergence
    gl.useProgram(progDivRef.current!.prog)
    gl.uniform2f(progDivRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, velocity.read.texture)
    gl.uniform1i(progDivRef.current!.uniforms.uVelocity, 0)
    blit(divFBO.fbo, S, S)

    // 4. Clear pressure
    gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.read.fbo)
    gl.viewport(0, 0, S, S)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // 5. Pressure solve (Jacobi)
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

    // 6. Gradient subtraction → divergence-free velocity
    gl.useProgram(progGradSubRef.current!.prog)
    gl.uniform2f(progGradSubRef.current!.uniforms.texelSize, 1/S, 1/S)
    bindTex(0, pressure.read.texture)
    gl.uniform1i(progGradSubRef.current!.uniforms.uPressure, 0)
    bindTex(1, velocity.read.texture)
    gl.uniform1i(progGradSubRef.current!.uniforms.uVelocity, 1)
    blit(velocity.write.fbo, S, S)
    velocity.swap()

    // 7. Advect velocity (self-advection with dissipation)
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

  // ── Splat mouse velocity into fluid ───────────────────────────────────────────
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

  // ── WebGL init ────────────────────────────────────────────────────────────────
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false
    }) as WebGLRenderingContext
    if (!gl) return
    glRef.current = gl

    // Half-float extension for fluid FBOs
    const hfExt = gl.getExtension('OES_texture_half_float')
    gl.getExtension('OES_texture_half_float_linear')
    const halfFloat = hfExt ? hfExt.HALF_FLOAT_OES : gl.UNSIGNED_BYTE
    halfFloatRef.current = halfFloat

    // Full-screen quad VAO
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    // All programs share texelSize uniform via BASE_VERT
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

    // Composite program uses its own vertex shader (handles UV flip + parallax pan)
    const comp = makeProgram(gl, COMPOSITE_VERT, COMPOSITE_FRAG)
    gl.useProgram(comp.prog)
    const compLoc = gl.getAttribLocation(comp.prog, 'aPos')
    gl.enableVertexAttribArray(compLoc)
    gl.vertexAttribPointer(compLoc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(comp.uniforms.uDispStrength, DISP_STRENGTH)
    gl.uniform1i(comp.uniforms.tFrame, 0)
    gl.uniform1i(comp.uniforms.tVelocity, 1)
    gl.uniform2f(comp.uniforms.uPan, 0, 0)
    progCompositeRef.current = comp

    // Fluid FBOs
    const S = SIM_RES
    velocityRef.current   = new DoubleFBO(gl, S, S, halfFloat)
    pressureRef.current   = new DoubleFBO(gl, S, S, halfFloat)
    divergenceRef.current = new SingleFBO(gl, S, S, halfFloat)
    curlFBORef.current    = new SingleFBO(gl, S, S, halfFloat)

    // Frame texture pool
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
    const canvas = canvasRef.current
    const gl     = glRef.current
    if (!canvas || !gl) return
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width  = window.innerWidth  * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width  = window.innerWidth  + 'px'
    canvas.style.height = window.innerHeight + 'px'
  }, [])

  // ── Checkpoint ────────────────────────────────────────────────────────────────
  const revealCheckpoint = useCallback(() => {
    if (checkpointShownRef.current) return
    checkpointShownRef.current = true
    const wrap = checkpointWrap.current, l1 = line1Ref.current, l2 = line2Ref.current
    if (!wrap || !l1 || !l2) return
    checkpointTlRef.current?.kill()
    split1Ref.current?.revert(); split2Ref.current?.revert()
    const s1 = new SplitText(l1, { type: 'chars' })
    const s2 = new SplitText(l2, { type: 'chars' })
    split1Ref.current = s1; split2Ref.current = s2
    const allChars = [...s1.chars, ...s2.chars] as HTMLElement[]
    allChars.forEach(ch => {
      ch.style.display   = 'inline-block'
      ch.style.opacity   = '0'
      ch.style.filter    = 'blur(20px)'
      ch.style.transform = 'translateY(-30px)'
      ch.style.color     = '#ffffff'
    })
    gsap.set(wrap, { visibility: 'visible', opacity: 1 })
    const tl = gsap.timeline()
    checkpointTlRef.current = tl
    tl.to(s1.chars as HTMLElement[], { opacity:1, filter:'blur(0px)', y:0, duration:1.2, ease:'power3.out', stagger:{each:0.05,from:'start'} }, 0)
    tl.to(s2.chars as HTMLElement[], { opacity:1, filter:'blur(0px)', y:0, duration:1.2, ease:'power3.out', stagger:{each:0.05,from:'start'} }, 0.25)
  }, [])

  const hideCheckpoint = useCallback(() => {
    if (!checkpointShownRef.current) return
    checkpointShownRef.current = false
    const wrap = checkpointWrap.current
    if (!wrap) return
    checkpointTlRef.current?.kill()
    gsap.to(wrap, {
      opacity:0, y:-20, filter:'blur(14px)', duration:0.5, ease:'power2.in',
      onComplete: () => {
        gsap.set(wrap, { visibility:'hidden', y:0, filter:'blur(0px)' })
        split1Ref.current?.revert(); split2Ref.current?.revert()
      }
    })
  }, [])

  // ── Render loop ───────────────────────────────────────────────────────────────
  const startRenderLoop = useCallback(() => {
    const gl = glRef.current
    if (!gl) return
    let running = true
    let lastT   = 0

    const paint = (t: number) => {
      if (!running) return
      const dt = Math.min((t - lastT) / 1000, 0.05)
      lastT = t

      const frameIdx = Math.max(0, Math.min(frameCount - 1, Math.round(targetFrameRef.current)))

      if (frameIdx === frameCount - 1 && !checkpointShownRef.current) revealCheckpoint()

      // Step fluid sim
      if (dt > 0) fluidStep(dt)

      // Parallax pan
      const mx = mouseNormRef.current.x - 0.5
      const my = mouseNormRef.current.y - 0.5
      parallaxRef.current.x += (mx * PARALLAX_STRENGTH - parallaxRef.current.x) * 0.04
      parallaxRef.current.y += (my * PARALLAX_STRENGTH - parallaxRef.current.y) * 0.04
      const panX =  (parallaxRef.current.x / window.innerWidth)  * 2
      const panY = -(parallaxRef.current.y / window.innerHeight) * 2

      // Composite: frame + velocity distortion → screen
      if (textureReady.current[frameIdx]) {
        const comp = progCompositeRef.current!
        gl.useProgram(comp.prog)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.uniform2f(comp.uniforms.uPan, panX, panY)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, frameTextures.current[frameIdx])
        gl.uniform1i(comp.uniforms.tFrame, 0)

        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, velocityRef.current!.read.texture)
        gl.uniform1i(comp.uniforms.tVelocity, 1)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }

      requestAnimationFrame(paint)
    }

    requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(paint) })
    return () => { running = false }
  }, [frameCount, fluidStep, revealCheckpoint])

  // ── Scroll ────────────────────────────────────────────────────────────────────
  const handleScroll = useCallback(({ direction }: { scroll: number; direction: number }) => {
    if (!isReadyRef.current) return
    if (direction === -1 && checkpointShownRef.current) hideCheckpoint()
    directionRef.current = direction
    if (animatingRef.current) return
    animatingRef.current = true

    const duration  = 1800
    const frameStep = (1 / 60) / (duration / 1000)

    const animate = () => {
      progressRef.current += directionRef.current * frameStep
      if (progressRef.current <= 0) {
        progressRef.current = 0; targetFrameRef.current = 0; animatingRef.current = false; return
      }
      if (progressRef.current >= 1) {
        progressRef.current = 1; targetFrameRef.current = frameCount - 1; animatingRef.current = false; return
      }
      const p     = progressRef.current
      const eased = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2,3)/2
      targetFrameRef.current = eased * (frameCount - 1)
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [frameCount, hideCheckpoint])

  // ── Mouse → splat ─────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top)  / rect.height
    const dx = nx - prevMouseRef.current.x
    const dy = ny - prevMouseRef.current.y
    prevMouseRef.current  = { x: nx, y: ny }
    mouseNormRef.current  = { x: nx, y: ny }
    if (Math.hypot(dx, dy) > 0.0005) {
      splat(nx, ny, dx, dy)
    }
  }, [splat])

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

        {/* Checkpoint */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
          <div
            ref={checkpointWrap}
            style={{
              position: 'absolute', top: '20%', left: '50%',
              transform: 'translateX(-50%)', textAlign: 'center',
              visibility: 'hidden', opacity: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1em',
            }}
          >
            <div ref={line1Ref} className="checkpoint-line">Checkpoint One</div>
            <div ref={line2Ref} className="checkpoint-line">Complete</div>
          </div>
        </div>

        {/* Loader */}
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
    </>
  )
}