  'use client'

  import { useEffect, useRef, useCallback, useState } from 'react'
  import { gsap } from 'gsap'
  import { SplitText } from 'gsap/SplitText'
  import type Lenis from '@studio-freight/lenis'

  gsap.registerPlugin(SplitText)

  // ── Config ────────────────────────────────────────────────────────────────────
  const PX_PER_FRAME      = 12
  const PARALLAX_STRENGTH = 18
  const SIM_RES           = 128
  const VELOCITY_DISS     = 0.80
  const PRESSURE_ITER     = 6
  const CURL_AMOUNT       = 30
  const SPLAT_RADIUS      = 0.12
  const SPLAT_FORCE       = 2500
  const DISP_STRENGTH     = 0.004
  const FRAME_DURATION    = 1600  // ms to sweep full video

  type CheckpointLabel = { title: string; sub: string }
  type Phase = 'playing' | 'checkpoint' | 'transitioning'

  type Props = {
    frameCount?: number
    folderPath?: string
    extension?: string
    labels?: CheckpointLabel[]
  }

  // ── FBOs ──────────────────────────────────────────────────────────────────────
  interface FBO { texture: WebGLTexture; fbo: WebGLFramebuffer }

  class DoubleFBO {
    read: FBO; write: FBO
    constructor(gl: WebGLRenderingContext, w: number, h: number, hf: number) {
      this.read  = DoubleFBO.make(gl, w, h, hf)
      this.write = DoubleFBO.make(gl, w, h, hf)
    }
    static make(gl: WebGLRenderingContext, w: number, h: number, type: number): FBO {
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
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT)
      return { texture, fbo }
    }
    swap() { const t = this.read; this.read = this.write; this.write = t }
  }

  class SingleFBO {
    texture: WebGLTexture; fbo: WebGLFramebuffer
    constructor(gl: WebGLRenderingContext, w: number, h: number, hf: number) {
      this.texture = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, hf, null)
      this.fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }

  function compile(gl: WebGLRenderingContext, type: number, src: string) {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src); gl.compileShader(s); return s
  }
  function mkProg(gl: WebGLRenderingContext, vert: string, frag: string) {
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

  // ── GLSL ──────────────────────────────────────────────────────────────────────
  const BASE_VERT = `
  precision highp float;
  attribute vec2 aPos;
  varying vec2 vUv,vL,vR,vT,vB;
  uniform vec2 texelSize;
  void main(){
    vUv=aPos*.5+.5;
    vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);
    vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);
    gl_Position=vec4(aPos,0.,1.);}`

  const SPLAT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec2 point,velocity;
  uniform float radius;
  void main(){
    vec2 p=vUv-point;p.x*=aspectRatio;
    float d=exp(-dot(p,p)/radius);
    gl_FragColor=vec4(texture2D(uTarget,vUv).xy+velocity*d,0.,1.);}`

  const ADVECT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity,uSource;
  uniform vec2 texelSize;
  uniform float dt,dissipation;
  void main(){
    vec2 v=texture2D(uVelocity,vUv).xy;
    vec2 c=vUv-dt*v*texelSize;
    gl_FragColor=dissipation*texture2D(uSource,c);gl_FragColor.a=1.;}`

  const CURL_FRAG = `
  precision mediump float;
  varying vec2 vUv,vL,vR,vT,vB;
  uniform sampler2D uVelocity;
  void main(){
    float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y;
    float T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;
    gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`

  const VORTICITY_FRAG = `
  precision highp float;
  varying vec2 vUv,vL,vR,vT,vB;
  uniform sampler2D uVelocity,uCurl;
  uniform float curl,dt;
  void main(){
    float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x;
    float T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x;
    float C=texture2D(uCurl,vUv).x;
    vec2 f=vec2(abs(T)-abs(B),abs(R)-abs(L));
    f/=length(f)+.0001;f*=curl*C;f.y*=-1.;
    gl_FragColor=vec4(texture2D(uVelocity,vUv).xy+f*dt,0.,1.);}`

  const DIVERGENCE_FRAG = `
  precision mediump float;
  varying vec2 vUv,vL,vR,vT,vB;
  uniform sampler2D uVelocity;
  void main(){
    float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x;
    float T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;
    gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`

  const PRESSURE_FRAG = `
  precision mediump float;
  varying vec2 vUv,vL,vR,vT,vB;
  uniform sampler2D uPressure,uDivergence;
  void main(){
    float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x;
    float T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;
    float d=texture2D(uDivergence,vUv).x;
    gl_FragColor=vec4((L+R+T+B-d)*.25,0.,0.,1.);}`

  const GRADSUB_FRAG = `
  precision mediump float;
  varying vec2 vUv,vL,vR,vT,vB;
  uniform sampler2D uPressure,uVelocity;
  void main(){
    float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x;
    float T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;
    vec2 v=texture2D(uVelocity,vUv).xy;
    gl_FragColor=vec4(v-vec2(R-L,T-B)*.5,0.,1.);}`

  const COMP_VERT = `
  precision highp float;
  attribute vec2 aPos;
  varying vec2 vUv;
  uniform vec2 uPan;
  void main(){
    vUv=aPos*.5+.5;vUv.y=1.-vUv.y;
    gl_Position=vec4(aPos+uPan,0.,1.);}`

  const COMP_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tFrame,tVelocity;
  uniform float uDispStrength;
  void main(){
    vec2 v=texture2D(tVelocity,vUv).xy;
    vec2 uv=clamp(vUv-v*uDispStrength,.001,.999);
    gl_FragColor=texture2D(tFrame,uv);}`

  // ── Component ─────────────────────────────────────────────────────────────────
  export default function VideoScrollExperience({
    frameCount = 121,
    folderPath = '/frames',
    extension  = 'webp',
    labels = [
      { title: 'Act One',   sub: 'The journey begins'         },
      { title: 'The Shift', sub: 'Something is changing'      },
      { title: 'The Turn',  sub: 'There is no going back now' },
      { title: 'The End',   sub: 'Everything leads here'      },
    ],
  }: Props) {
    const NUM_STAGES = labels.length

    // DOM
    const wrapperRef = useRef<HTMLDivElement>(null)
    const canvasRef  = useRef<HTMLCanvasElement>(null)
    const lenisRef   = useRef<Lenis | null>(null)
    const cpWraps    = useRef<(HTMLDivElement | null)[]>(Array(NUM_STAGES).fill(null))
    const cpTitles   = useRef<(HTMLDivElement | null)[]>(Array(NUM_STAGES).fill(null))
    const cpSubs     = useRef<(HTMLDivElement | null)[]>(Array(NUM_STAGES).fill(null))

    // WebGL
    const glRef      = useRef<WebGLRenderingContext | null>(null)
    const frameTex   = useRef<(WebGLTexture | null)[]>([])
    const texReady   = useRef<boolean[]>([])
    const velFBO     = useRef<DoubleFBO | null>(null)
    const prsFBO     = useRef<DoubleFBO | null>(null)
    const divFBO     = useRef<SingleFBO | null>(null)
    const curlFBO    = useRef<SingleFBO | null>(null)
    const pSplat     = useRef<ReturnType<typeof mkProg> | null>(null)
    const pAdvect    = useRef<ReturnType<typeof mkProg> | null>(null)
    const pCurl      = useRef<ReturnType<typeof mkProg> | null>(null)
    const pVort      = useRef<ReturnType<typeof mkProg> | null>(null)
    const pDiv       = useRef<ReturnType<typeof mkProg> | null>(null)
    const pPressure  = useRef<ReturnType<typeof mkProg> | null>(null)
    const pGradSub   = useRef<ReturnType<typeof mkProg> | null>(null)
    const pComp      = useRef<ReturnType<typeof mkProg> | null>(null)

    // ── Stage machine (all refs, mutated directly) ────────────────────────────
    // stageRef    : 0-3, which video section we're in
    // phaseRef    : 'playing' | 'checkpoint' | 'transitioning'
    // animProgress: 0..1 smooth position within current stage's video
    // animDir     : +1 forward / -1 backward
    // animating   : whether video is currently sweeping
    const stageRef       = useRef(0)
    const phaseRef       = useRef<Phase>('playing')
    const frameRef       = useRef(0)
    const animProgress   = useRef(0)
    const animDir        = useRef(1)
    const animating      = useRef(false)
    const isReadyRef       = useRef(false)
    const scrollDirRef     = useRef(0)
    // Timestamp (ms) when we last entered checkpoint phase.
    // Scroll input is ignored for CHECKPOINT_COOLDOWN ms after that,
    // so the text has time to animate in before the next scroll dismisses it.
    const cpEnteredAtRef   = useRef(0)
    const CHECKPOINT_COOLDOWN = 900  // ms

    // Mouse / parallax
    const mouseRef  = useRef({ x: 0.5, y: 0.5 })
    const prevMouse = useRef({ x: 0.5, y: 0.5 })
    const parallax  = useRef({ x: 0, y: 0 })

    const [loadPct, setLoadPct] = useState(0)
    const [loaded,  setLoaded ] = useState(false)

    // ── WebGL helpers ─────────────────────────────────────────────────────────
    const blit = useCallback((fbo: WebGLFramebuffer | null, w: number, h: number) => {
      const gl = glRef.current!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, w, h)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }, [])

    const bindTex = useCallback((unit: number, tex: WebGLTexture) => {
      const gl = glRef.current!
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
    }, [])

    // ── Checkpoint GSAP ───────────────────────────────────────────────────────
    const showCP = useCallback((idx: number) => {
      const wrap  = cpWraps.current[idx]
      const title = cpTitles.current[idx]
      const sub   = cpSubs.current[idx]
      if (!wrap || !title || !sub) return

      gsap.killTweensOf(wrap)
      const s1 = new SplitText(title, { type: 'chars' })
      const s2 = new SplitText(sub,   { type: 'chars' })

      ;[...s1.chars, ...s2.chars].forEach(ch => {
        const el = ch as HTMLElement
        el.style.display = 'inline-block'
        el.style.opacity = '0'
        el.style.filter  = 'blur(20px)'
        el.style.transform = 'translateY(-30px)'
      })
      gsap.set(wrap, { visibility: 'visible', opacity: 1, y: 0, filter: 'blur(0px)' })

      gsap.timeline()
        .to(s1.chars as HTMLElement[], {
          opacity: 1, filter: 'blur(0px)', y: 0,
          duration: 1.2, ease: 'power3.out',
          stagger: { each: 0.05, from: 'start' },
        }, 0)
        .to(s2.chars as HTMLElement[], {
          opacity: 1, filter: 'blur(0px)', y: 0,
          duration: 1.0, ease: 'power3.out',
          stagger: { each: 0.04, from: 'start' },
        }, 0.3)
    }, [])

    const hideCP = useCallback((idx: number, onDone: () => void) => {
      const wrap = cpWraps.current[idx]
      if (!wrap) { onDone(); return }
      gsap.killTweensOf(wrap)
      gsap.to(wrap, {
        opacity: 0, y: -24, filter: 'blur(14px)',
        duration: 0.4, ease: 'power2.in',
        onComplete: () => {
          gsap.set(wrap, { visibility: 'hidden', y: 0, filter: 'blur(0px)' })
          onDone()
        },
      })
    }, [])

    // ── Fluid sim ─────────────────────────────────────────────────────────────
    const fluidStep = useCallback((dt: number) => {
      const gl  = glRef.current!
      const vel = velFBO.current!
      const prs = prsFBO.current!
      const dF  = divFBO.current!
      const cF  = curlFBO.current!
      const S   = SIM_RES

      gl.useProgram(pCurl.current!.prog)
      gl.uniform2f(pCurl.current!.uniforms.texelSize, 1/S, 1/S)
      bindTex(0, vel.read.texture); gl.uniform1i(pCurl.current!.uniforms.uVelocity, 0)
      blit(cF.fbo, S, S)

      gl.useProgram(pVort.current!.prog)
      gl.uniform2f(pVort.current!.uniforms.texelSize, 1/S, 1/S)
      bindTex(0, vel.read.texture); gl.uniform1i(pVort.current!.uniforms.uVelocity, 0)
      bindTex(1, cF.texture);       gl.uniform1i(pVort.current!.uniforms.uCurl, 1)
      gl.uniform1f(pVort.current!.uniforms.curl, CURL_AMOUNT)
      gl.uniform1f(pVort.current!.uniforms.dt, dt)
      blit(vel.write.fbo, S, S); vel.swap()

      gl.useProgram(pDiv.current!.prog)
      gl.uniform2f(pDiv.current!.uniforms.texelSize, 1/S, 1/S)
      bindTex(0, vel.read.texture); gl.uniform1i(pDiv.current!.uniforms.uVelocity, 0)
      blit(dF.fbo, S, S)

      gl.bindFramebuffer(gl.FRAMEBUFFER, prs.read.fbo)
      gl.viewport(0, 0, S, S); gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(pPressure.current!.prog)
      gl.uniform2f(pPressure.current!.uniforms.texelSize, 1/S, 1/S)
      bindTex(1, dF.texture); gl.uniform1i(pPressure.current!.uniforms.uDivergence, 1)
      for (let i = 0; i < PRESSURE_ITER; i++) {
        bindTex(0, prs.read.texture); gl.uniform1i(pPressure.current!.uniforms.uPressure, 0)
        blit(prs.write.fbo, S, S); prs.swap()
      }

      gl.useProgram(pGradSub.current!.prog)
      gl.uniform2f(pGradSub.current!.uniforms.texelSize, 1/S, 1/S)
      bindTex(0, prs.read.texture); gl.uniform1i(pGradSub.current!.uniforms.uPressure, 0)
      bindTex(1, vel.read.texture); gl.uniform1i(pGradSub.current!.uniforms.uVelocity, 1)
      blit(vel.write.fbo, S, S); vel.swap()

      gl.useProgram(pAdvect.current!.prog)
      gl.uniform2f(pAdvect.current!.uniforms.texelSize, 1/S, 1/S)
      gl.uniform1f(pAdvect.current!.uniforms.dt, dt)
      gl.uniform1f(pAdvect.current!.uniforms.dissipation, VELOCITY_DISS)
      bindTex(0, vel.read.texture); gl.uniform1i(pAdvect.current!.uniforms.uVelocity, 0)
      bindTex(1, vel.read.texture); gl.uniform1i(pAdvect.current!.uniforms.uSource, 1)
      blit(vel.write.fbo, S, S); vel.swap()
    }, [blit, bindTex])

    const splat = useCallback((x: number, y: number, dx: number, dy: number) => {
      const gl  = glRef.current!
      const vel = velFBO.current!
      const S   = SIM_RES
      gl.useProgram(pSplat.current!.prog)
      gl.uniform2f(pSplat.current!.uniforms.texelSize, 1/S, 1/S)
      bindTex(0, vel.read.texture); gl.uniform1i(pSplat.current!.uniforms.uTarget, 0)
      gl.uniform1f(pSplat.current!.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height)
      gl.uniform2f(pSplat.current!.uniforms.point, x, y)
      gl.uniform2f(pSplat.current!.uniforms.velocity, dx * SPLAT_FORCE, dy * SPLAT_FORCE)
      gl.uniform1f(pSplat.current!.uniforms.radius, SPLAT_RADIUS / 100)
      blit(vel.write.fbo, S, S); vel.swap()
    }, [blit, bindTex])

    // ── WebGL init ────────────────────────────────────────────────────────────
    const initWebGL = useCallback(() => {
      const canvas = canvasRef.current; if (!canvas) return
      const gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false,
      }) as WebGLRenderingContext
      if (!gl) return
      glRef.current = gl

      const hfExt = gl.getExtension('OES_texture_half_float')
      gl.getExtension('OES_texture_half_float_linear')
      const hf = hfExt ? hfExt.HALF_FLOAT_OES : gl.UNSIGNED_BYTE

      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW)

      const reg = (frag: string, vert = BASE_VERT) => {
        const p = mkProg(gl, vert, frag)
        gl.useProgram(p.prog)
        const loc = gl.getAttribLocation(p.prog, 'aPos')
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
        return p
      }
      pSplat.current    = reg(SPLAT_FRAG)
      pAdvect.current   = reg(ADVECT_FRAG)
      pCurl.current     = reg(CURL_FRAG)
      pVort.current     = reg(VORTICITY_FRAG)
      pDiv.current      = reg(DIVERGENCE_FRAG)
      pPressure.current = reg(PRESSURE_FRAG)
      pGradSub.current  = reg(GRADSUB_FRAG)

      const comp = reg(COMP_FRAG, COMP_VERT)
      gl.uniform1f(comp.uniforms.uDispStrength, DISP_STRENGTH)
      gl.uniform1i(comp.uniforms.tFrame, 0)
      gl.uniform1i(comp.uniforms.tVelocity, 1)
      gl.uniform2f(comp.uniforms.uPan, 0, 0)
      pComp.current = comp

      const S = SIM_RES
      velFBO.current  = new DoubleFBO(gl, S, S, hf)
      prsFBO.current  = new DoubleFBO(gl, S, S, hf)
      divFBO.current  = new SingleFBO(gl, S, S, hf)
      curlFBO.current = new SingleFBO(gl, S, S, hf)

      frameTex.current = Array.from({ length: frameCount }, () => {
        const t = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        return t
      })
      texReady.current = new Array(frameCount).fill(false)
    }, [frameCount])

    const uploadBitmap = useCallback((bmp: ImageBitmap, i: number) => {
      const gl = glRef.current; if (!gl) return
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, frameTex.current[i])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp)
      texReady.current[i] = true
      bmp.close()
    }, [])

    const preloadFrames = useCallback(async () => {
      let done = 0
      const load = async (i: number) => {
        const n = (i + 1).toString().padStart(4, '0')
        try {
          const r   = await fetch(`${folderPath}/frame_${n}.${extension}`)
          const b   = await r.blob()
          const bmp = await createImageBitmap(b, { resizeQuality: 'high' })
          if (glRef.current) uploadBitmap(bmp, i)
        } catch { /* skip */ }
        done++
        setLoadPct(Math.round((done / frameCount) * 100))
      }
      const BATCH = 12
      for (let i = 0; i < frameCount; i += BATCH)
        await Promise.all(Array.from({ length: Math.min(BATCH, frameCount - i) }, (_, k) => load(i + k)))
      isReadyRef.current = true
      setLoaded(true)
    }, [frameCount, folderPath, extension, uploadBitmap])

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current; const gl = glRef.current
      if (!canvas || !gl) return
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width  = window.innerWidth  * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width  = window.innerWidth  + 'px'
      canvas.style.height = window.innerHeight + 'px'
    }, [])

    // ── RENDER LOOP — runs once, reads all mutable refs directly ──────────────
    useEffect(() => {
      let running = true
      let lastT   = 0

      const paint = (t: number) => {
        if (!running) return
        const dt = Math.min((t - lastT) / 1000, 0.05)
        lastT = t

        const gl = glRef.current
        if (!gl) { requestAnimationFrame(paint); return }

        // ── Consume scroll input ────────────────────────────────────────────────
        const dir   = scrollDirRef.current
        const phase = phaseRef.current

        if (dir !== 0 && isReadyRef.current) {
          scrollDirRef.current = 0

          if (phase === 'playing') {
            // If already animating just flip or keep direction
            animDir.current   = dir
            animating.current = true

          } else if (phase === 'checkpoint') {
            // Ignore scroll until cooldown has elapsed — lets text animate in
            const elapsed = performance.now() - cpEnteredAtRef.current
            if (elapsed < CHECKPOINT_COOLDOWN) {
              // too soon — put the direction back so next frame can retry
              scrollDirRef.current = dir
            } else {
              // Cooldown passed — handle the scroll
              // Lock out further input until GSAP transition finishes
              phaseRef.current = 'transitioning'
              const idx = stageRef.current

              if (dir > 0) {
                // ── Forward: dismiss CP → advance to next stage ─────────────────
                hideCP(idx, () => {
                  if (idx < NUM_STAGES - 1) {
                    stageRef.current     = idx + 1
                    animProgress.current = 0
                    frameRef.current     = 0
                    animDir.current      = 1
                    animating.current    = true
                    phaseRef.current     = 'playing'
                  } else {
                    // Final stage done — stay on last frame, no more input
                    phaseRef.current = 'checkpoint' // keep locked at end
                  }
                })
              } else {
                // ── Backward: dismiss CP → rewind current stage's video ─────────
                hideCP(idx, () => {
                  // Stay on same stage, rewind from end (progress = 1)
                  animProgress.current = 1
                  frameRef.current     = frameCount - 1
                  animDir.current      = -1
                  animating.current    = true
                  phaseRef.current     = 'playing'
                })
              }
            }
          }
          // 'transitioning' ignores all scroll — gate is closed
        }

        // ── Advance frame animation ─────────────────────────────────────────────
        if (animating.current && phaseRef.current === 'playing') {
          const step = (1 / 60) / (FRAME_DURATION / 1000)
          animProgress.current += animDir.current * step

          if (animProgress.current >= 1) {
            // ── Hit end of video → show checkpoint ─────────────────────────────
            animProgress.current  = 1
            frameRef.current      = frameCount - 1
            animating.current     = false
            phaseRef.current      = 'checkpoint'
            cpEnteredAtRef.current = performance.now()
            scrollDirRef.current   = 0   // flush any queued scroll
            showCP(stageRef.current)

          } else if (animProgress.current <= 0) {
            // ── Rewound past frame 0 ───────────────────────────────────────────
            animProgress.current = 0
            frameRef.current     = 0
            animating.current    = false

            if (stageRef.current > 0) {
              // ── Go back to previous stage's checkpoint ──────────────────────
              stageRef.current -= 1
              animProgress.current = 1
              frameRef.current     = frameCount - 1
              phaseRef.current     = 'checkpoint'
              cpEnteredAtRef.current = performance.now()
              scrollDirRef.current   = 0   // flush queued scroll
              showCP(stageRef.current)
            }
            // If stage 0 and rewound past 0: just stay at frame 0, phase 'playing'

          } else {
            // ── Normal interpolation ───────────────────────────────────────────
            const p     = animProgress.current
            const eased = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2
            frameRef.current = Math.round(eased * (frameCount - 1))
          }
        }

        // ── Fluid ───────────────────────────────────────────────────────────────
        if (dt > 0) fluidStep(dt)

        // ── Parallax ────────────────────────────────────────────────────────────
        const mx = mouseRef.current.x - 0.5
        const my = mouseRef.current.y - 0.5
        parallax.current.x += (mx * PARALLAX_STRENGTH - parallax.current.x) * 0.04
        parallax.current.y += (my * PARALLAX_STRENGTH - parallax.current.y) * 0.04
        const panX =  (parallax.current.x / window.innerWidth)  * 2
        const panY = -(parallax.current.y / window.innerHeight) * 2

        // ── Composite ───────────────────────────────────────────────────────────
        const f = frameRef.current
        if (texReady.current[f] && velFBO.current) {
          const comp = pComp.current!
          gl.useProgram(comp.prog)
          gl.bindFramebuffer(gl.FRAMEBUFFER, null)
          gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
          gl.uniform2f(comp.uniforms.uPan, panX, panY)
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, frameTex.current[f])
          gl.uniform1i(comp.uniforms.tFrame, 0)
          gl.activeTexture(gl.TEXTURE1)
          gl.bindTexture(gl.TEXTURE_2D, velFBO.current.read.texture)
          gl.uniform1i(comp.uniforms.tVelocity, 1)
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }

        requestAnimationFrame(paint)
      }

      requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(paint) })
      return () => { running = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // runs once — everything via stable refs

    // ── Scroll handler ────────────────────────────────────────────────────────
    const handleScroll = useCallback(({ direction }: { scroll: number; direction: number }) => {
      if (!isReadyRef.current) return
      scrollDirRef.current = direction
    }, [])

    // ── Mouse ─────────────────────────────────────────────────────────────────
    const handleMouseMove = useCallback((e: MouseEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect(); if (!rect) return
      const nx = (e.clientX - rect.left) / rect.width
      const ny = (e.clientY - rect.top)  / rect.height
      const dx = nx - prevMouse.current.x
      const dy = ny - prevMouse.current.y
      prevMouse.current = { x: nx, y: ny }
      mouseRef.current  = { x: nx, y: ny }
      if (Math.hypot(dx, dy) > 0.0005) splat(nx, ny, dx, dy)
    }, [splat])

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    useEffect(() => {
      let lenis: Lenis | undefined
      const init = async () => {
        initWebGL()
        resizeCanvas()
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
        window.removeEventListener('resize',    resizeCanvas)
        window.removeEventListener('mousemove', handleMouseMove)
        const gl = glRef.current
        if (gl) frameTex.current.forEach(t => t && gl.deleteTexture(t))
      }
    }, [initWebGL, resizeCanvas, preloadFrames, handleScroll, handleMouseMove])

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
          * { scrollbar-width: none; }
          *::-webkit-scrollbar { display: none; }
          .cp-counter {
            font-family: 'Anton', sans-serif;
            font-size: clamp(0.6rem, 1.2vw, 0.85rem);
            letter-spacing: 0.35em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.3);
            margin-bottom: 0.6em;
          }
          .cp-title {
            font-family: 'Anton', sans-serif;
            font-size: clamp(2.8rem, 8vw, 6rem);
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #ffffff;
            line-height: 1.05;
            display: block;
          }
          .cp-sub {
            font-family: 'Anton', sans-serif;
            font-size: clamp(1rem, 2.5vw, 1.8rem);
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.5);
            line-height: 1.2;
            display: block;
            margin-top: 0.25em;
          }
        `}</style>

        <div style={{ height: `calc(${NUM_STAGES * frameCount * PX_PER_FRAME}px + 100vh)`, position: 'relative' }}>

          <div
            ref={wrapperRef}
            style={{ position:'fixed', inset:0, width:'100vw', height:'100vh', overflow:'hidden', background:'#000' }}
          >
            <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'100%' }} />
          </div>

          <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:20 }}>
            {labels.map((label, i) => (
              <div
                key={i}
                ref={el => { cpWraps.current[i] = el }}
                style={{
                  position:'absolute', top:'20%', left:'50%',
                  transform:'translateX(-50%)', textAlign:'center',
                  visibility:'hidden', opacity:0,
                  display:'flex', flexDirection:'column',
                  alignItems:'center', whiteSpace:'nowrap',
                }}
              >
                <div className="cp-counter">
                  {String(i + 1).padStart(2, '0')} / {String(NUM_STAGES).padStart(2, '0')}
                </div>
                <div ref={el => { cpTitles.current[i] = el }} className="cp-title">
                  {label.title}
                </div>
                <div ref={el => { cpSubs.current[i] = el }} className="cp-sub">
                  {label.sub}
                </div>
              </div>
            ))}
          </div>

          {!loaded && (
            <div style={{
              position:'fixed', inset:0, zIndex:100, background:'#000',
              display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', gap:'2rem',
            }}>
              <div style={{ width:'260px', height:'1px', background:'rgba(255,255,255,0.12)', position:'relative', overflow:'hidden' }}>
                <div style={{
                  position:'absolute', inset:0, background:'#fff',
                  transformOrigin:'left',
                  transform:`scaleX(${loadPct/100})`,
                  transition:'transform 0.3s ease',
                }} />
              </div>
              <p style={{
                fontFamily:'"Anton",sans-serif', fontSize:'0.75rem',
                letterSpacing:'0.3em', textTransform:'uppercase',
                color:'rgba(255,255,255,0.4)', margin:0,
              }}>
                {loadPct < 100 ? `Loading — ${loadPct}%` : 'Starting…'}
              </p>
            </div>
          )}

        </div>
      </>
    )
  }