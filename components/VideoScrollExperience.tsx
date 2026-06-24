"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import Loop0 from "./loops/Loop0";
import Loop1 from "./loops/Loop1";
import Loop2 from "./loops/Loop2";
import Loop3 from "./loops/Loop3";
import Loop4 from "./loops/Loop4";
import Loop5 from "./loops/Loop5";
import Loop6 from "./loops/Loop6";
import Loop8 from "./loops/Loop8";
import Loop9 from "./loops/Loop9";
import Image from "next/image";
import AgendaContent from "./loops/Agenda";
import HighContent from "./loops/HighContent";
import StarfieldBackground from "./StarfieldBackground";

gsap.registerPlugin(SplitText);

// ── Config ────────────────────────────────────────────────────────────────────
const SOURCE_FPS        = 24;
const TRANSITION_FPS    = 45;
const PARALLAX_STRENGTH = 0.032;
const PARALLAX_LERP     = 0.06;
const ZOOM              = 1.12;
const CONTENT_FADE_MS   = 280;

// ── Stair transition config ───────────────────────────────────────────────────
const STAIR_COUNT       = 5;
const STAIR_DURATION_MS = 180;
const STAIR_SETTLE_MS   = 600;

// ── Loop ranges (0-indexed) ───────────────────────────────────────────────────
const LOOPS = [
  { start: 10,  end: 48   },
  { start: 125, end: 168  },
  { start: 220, end: 260  },
  { start: 430, end: 450  },
  { start: 660, end: 680  },
  { start: 845, end: 870  },
  { start: 1100, end: 1222 },
];

const LOOP_CONTENT = [
  { component: Loop0 },
  { component: Loop1 },
  { component: Loop2 },
  { component: Loop3 },
  { component: Loop4 },
  { component: HighContent },
  { component: AgendaContent },
];

// ── Nav labels (7 items) ──────────────────────────────────────────────────────
const NAV_LABELS = ["Origin", "Discover", "Highlights", "Agenda", "Speakers", "Awards", "Passes"];

// Loop index → nav index mapping
// Loops 0,1,2 → Origin (0)
// Loops 3,4   → Discover (1)
// Loop 5      → Highlights (2)
// Loop 6      → Agenda (3)
// Static content starts at Speakers (4)
const getNavIdx = (activeLoopIdx: number, showStaticContent: boolean) => {
  if (showStaticContent) return 4;
  if (activeLoopIdx <= 2) return 0;
  if (activeLoopIdx <= 4) return 1;
  if (activeLoopIdx === 5) return 2;
  return 3;
};

// Nav click → loop index mapping
const NAV_LOOP_MAP: Record<number, number> = {
  0: 0, // Origin     → Loop0
  1: 3, // Discover   → Loop3
  2: 5, // Highlights → Loop5
  3: 6, // Agenda     → Loop6
};

// ── Fluid sim constants ───────────────────────────────────────────────────────
const SIM_RES       = 128;
const VELOCITY_DISS = 0.8;
const PRESSURE_ITER = 6;
const CURL_AMOUNT   = 30;
const SPLAT_RADIUS  = 0.030;
const SPLAT_FORCE   = 2500;
const DISP_STRENGTH = 0.004;

const SCROLL_THRESHOLD = 30;
const WINDOW_BEHIND    = 30;
const WINDOW_AHEAD     = 150;
const FETCH_BATCH      = 24;
const INTERLOOP_PREFETCH_BATCH = 16;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

type Props = {
  frameCount?: number;
  folderPath?: string;
  extension?: string;
};

interface FBO { texture: WebGLTexture; fbo: WebGLFramebuffer; }

class DoubleFBO {
  read: FBO; write: FBO;
  constructor(gl: WebGLRenderingContext, w: number, h: number, t: number) {
    this.read  = DoubleFBO.make(gl, w, h, t);
    this.write = DoubleFBO.make(gl, w, h, t);
  }
  static make(gl: WebGLRenderingContext, w: number, h: number, type: number): FBO {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, fbo };
  }
  swap() { const t = this.read; this.read = this.write; this.write = t; }
}

class SingleFBO {
  texture: WebGLTexture; fbo: WebGLFramebuffer;
  constructor(gl: WebGLRenderingContext, w: number, h: number, type: number) {
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s;
}
function makeProgram(gl: WebGLRenderingContext, vert: string, frag: string) {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  const uniforms: Record<string, WebGLUniformLocation> = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i)!.name;
    uniforms[name] = gl.getUniformLocation(prog, name)!;
  }
  return { prog, uniforms };
}

// ── Shaders ───────────────────────────────────────────────────────────────────
const BASE_VERT = `
  precision highp float;
  attribute vec2 aPos;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform vec2 texelSize;
  void main(){
    vUv=aPos*.5+.5;
    vL=vUv-vec2(texelSize.x,0.); vR=vUv+vec2(texelSize.x,0.);
    vT=vUv+vec2(0.,texelSize.y); vB=vUv-vec2(0.,texelSize.y);
    gl_Position=vec4(aPos,0.,1.);
  }`;

const SPLAT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec2 point, velocity;
  uniform float radius;
  void main(){
    vec2 p=vUv-point; p.x*=aspectRatio;
    float d=exp(-dot(p,p)/radius);
    gl_FragColor=vec4(texture2D(uTarget,vUv).xy+velocity*d,0.,1.);
  }`;

const ADVECT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity, uSource;
  uniform vec2 texelSize;
  uniform float dt, dissipation;
  void main(){
    vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;
    gl_FragColor=dissipation*texture2D(uSource,coord);
    gl_FragColor.a=1.;
  }`;

const CURL_FRAG = `
  precision mediump float;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uVelocity;
  void main(){
    gl_FragColor=vec4(.5*(texture2D(uVelocity,vR).y-texture2D(uVelocity,vL).y
      -texture2D(uVelocity,vT).x+texture2D(uVelocity,vB).x),0.,0.,1.);
  }`;

const VORTICITY_FRAG = `
  precision highp float;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uVelocity, uCurl;
  uniform float curl, dt;
  void main(){
    float L=texture2D(uCurl,vL).x, R=texture2D(uCurl,vR).x;
    float T=texture2D(uCurl,vT).x, B=texture2D(uCurl,vB).x;
    float C=texture2D(uCurl,vUv).x;
    vec2 force=vec2(abs(T)-abs(B),abs(R)-abs(L));
    force/=length(force)+.0001; force*=curl*C; force.y*=-1.;
    gl_FragColor=vec4(texture2D(uVelocity,vUv).xy+force*dt,0.,1.);
  }`;

const DIVERGENCE_FRAG = `
  precision mediump float;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uVelocity;
  void main(){
    gl_FragColor=vec4(.5*(texture2D(uVelocity,vR).x-texture2D(uVelocity,vL).x
      +texture2D(uVelocity,vT).y-texture2D(uVelocity,vB).y),0.,0.,1.);
  }`;

const PRESSURE_FRAG = `
  precision mediump float;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uPressure, uDivergence;
  void main(){
    gl_FragColor=vec4((texture2D(uPressure,vL).x+texture2D(uPressure,vR).x
      +texture2D(uPressure,vT).x+texture2D(uPressure,vB).x
      -texture2D(uDivergence,vUv).x)*.25,0.,0.,1.);
  }`;

const GRAD_SUB_FRAG = `
  precision mediump float;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uPressure, uVelocity;
  void main(){
    gl_FragColor=vec4(texture2D(uVelocity,vUv).xy-vec2(
      texture2D(uPressure,vR).x-texture2D(uPressure,vL).x,
      texture2D(uPressure,vT).x-texture2D(uPressure,vB).x)*.5,0.,1.);
  }`;

const COMPOSITE_VERT = `
  precision highp float;
  attribute vec2 aPos;
  varying vec2 vUv;
  void main(){ vUv=aPos*.5+.5; vUv.y=1.-vUv.y; gl_Position=vec4(aPos,0.,1.); }`;

const COMPOSITE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tFrame, tPrev, tVelocity;
  uniform float uDispStrength, uZoom, uBlend;
  uniform vec2 uPan;
  void main(){
    vec2 uv=clamp((vUv-.5)/uZoom+.5+uPan-texture2D(tVelocity,vUv).xy*uDispStrength,.001,.999);
    gl_FragColor=mix(texture2D(tPrev,uv), texture2D(tFrame,uv), uBlend);
  }`;

// ── Bitmap cache ──────────────────────────────────────────────────────────────
const BITMAP_CACHE = new Map<number, ImageBitmap>();
const trimBitmapCache = (max = 600) => {
  if (BITMAP_CACHE.size <= max) return;
  const keys = Array.from(BITMAP_CACHE.keys());
  for (const k of keys.slice(0, BITMAP_CACHE.size - max)) {
    BITMAP_CACHE.get(k)?.close();
    BITMAP_CACHE.delete(k);
  }
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoScrollExperience({
  frameCount = 1022,
  folderPath = "https://images.mastersunion.link/bio-frames/19062026/v1",
  extension  = "webp",
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const glRef      = useRef<WebGLRenderingContext | null>(null);

  const frameTextures = useRef<(WebGLTexture | null)[]>([]);
  const textureReady  = useRef<boolean[]>([]);
  const loadingSet    = useRef<Set<number>>(new Set());
  const abortMap      = useRef<Map<number, AbortController>>(new Map());

  const velocityRef   = useRef<DoubleFBO | null>(null);
  const pressureRef   = useRef<DoubleFBO | null>(null);
  const divergenceRef = useRef<SingleFBO | null>(null);
  const curlFBORef    = useRef<SingleFBO | null>(null);

  const progSplatRef     = useRef<ReturnType<typeof makeProgram> | null>(null);
  const progAdvectRef    = useRef<ReturnType<typeof makeProgram> | null>(null);
  const progCurlRef      = useRef<ReturnType<typeof makeProgram> | null>(null);
  const progVorticityRef = useRef<ReturnType<typeof makeProgram> | null>(null);
  const progDivRef       = useRef<ReturnType<typeof makeProgram> | null>(null);
  const progPressureRef  = useRef<ReturnType<typeof makeProgram> | null>(null);
  const progGradSubRef   = useRef<ReturnType<typeof makeProgram> | null>(null);
  const progCompositeRef = useRef<ReturnType<typeof makeProgram> | null>(null);

  const frameFloatRef  = useRef(0);
  const directionRef   = useRef(0);
  const currentLoopRef = useRef(0);
  const readyRef       = useRef(false);
  const scrollAccRef   = useRef(0);
  const loopPlayDirRef = useRef(1);

  const isTransitioningRef    = useRef(false);
  const transitionTotalRef    = useRef(0);
  const transitionCoveredRef  = useRef(0);
  const transitionDirRef      = useRef(0);
  const transitionTargetRef   = useRef(0);

  const cachedUpToLoopRef = useRef(-1);
  const bgCachingRef      = useRef(false);

  // ── Page transition guards ────────────────────────────────────────────────
  const endTransitionFiredRef    = useRef(false);
  const returnTransitionFiredRef = useRef(false);
  const stairBusyRef             = useRef(false);

  const prevFrameTexRef = useRef<WebGLTexture | null>(null);
  const blendRef        = useRef(1.0);

  const mouseNormRef = useRef({ x: 0.5, y: 0.5 });
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 });
  const parallaxRef  = useRef({ x: 0, y: 0 });

  const [loadPct, setLoadPct]               = useState(0);
  const [loaded, setLoaded]                 = useState(false);
  const [debugFrame, setDebugFrame]         = useState(0);
  const [debugPhase, setDebugPhase]         = useState("INIT");
  const [activeLoopIdx, setActiveLoopIdx]   = useState(0);
  const [pillTop, setPillTop]               = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const navItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [showStaticContent, setShowStaticContent] = useState(false);

  const [stairVisible, setStairVisible] = useState<boolean[]>(
    Array(STAIR_COUNT).fill(false)
  );

  const staticScrollRef = useRef<HTMLDivElement>(null);

  // ── Pill position ─────────────────────────────────────────────────────────
  useEffect(() => {
    const navIdx  = getNavIdx(activeLoopIdx, showStaticContent);
    const navWrap = navItemRefs.current[0]?.parentElement;
    const item    = navItemRefs.current[navIdx];
    if (!navWrap || !item) return;
    const wrapTop  = navWrap.getBoundingClientRect().top;
    const itemRect = item.getBoundingClientRect();
    setPillTop(itemRect.top - wrapTop + itemRect.height / 2);
  }, [activeLoopIdx, showStaticContent]);

  // ── WebGL helpers ─────────────────────────────────────────────────────────
  const blit = useCallback((fbo: WebGLFramebuffer | null, w: number, h: number) => {
    const gl = glRef.current!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  const bindTex = useCallback((unit: number, tex: WebGLTexture) => {
    const gl = glRef.current!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }, []);

  // ── Fluid sim ─────────────────────────────────────────────────────────────
  const fluidStep = useCallback((dt: number) => {
    const gl  = glRef.current!;
    const vel = velocityRef.current!;
    const prs = pressureRef.current!;
    const div = divergenceRef.current!;
    const cur = curlFBORef.current!;
    const S   = SIM_RES;

    gl.useProgram(progCurlRef.current!.prog);
    gl.uniform2f(progCurlRef.current!.uniforms.texelSize, 1/S, 1/S);
    bindTex(0, vel.read.texture);
    gl.uniform1i(progCurlRef.current!.uniforms.uVelocity, 0);
    blit(cur.fbo, S, S);

    gl.useProgram(progVorticityRef.current!.prog);
    gl.uniform2f(progVorticityRef.current!.uniforms.texelSize, 1/S, 1/S);
    bindTex(0, vel.read.texture); gl.uniform1i(progVorticityRef.current!.uniforms.uVelocity, 0);
    bindTex(1, cur.texture);      gl.uniform1i(progVorticityRef.current!.uniforms.uCurl, 1);
    gl.uniform1f(progVorticityRef.current!.uniforms.curl, CURL_AMOUNT);
    gl.uniform1f(progVorticityRef.current!.uniforms.dt, dt);
    blit(vel.write.fbo, S, S); vel.swap();

    gl.useProgram(progDivRef.current!.prog);
    gl.uniform2f(progDivRef.current!.uniforms.texelSize, 1/S, 1/S);
    bindTex(0, vel.read.texture); gl.uniform1i(progDivRef.current!.uniforms.uVelocity, 0);
    blit(div.fbo, S, S);

    gl.bindFramebuffer(gl.FRAMEBUFFER, prs.read.fbo);
    gl.viewport(0, 0, S, S); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(progPressureRef.current!.prog);
    gl.uniform2f(progPressureRef.current!.uniforms.texelSize, 1/S, 1/S);
    bindTex(1, div.texture); gl.uniform1i(progPressureRef.current!.uniforms.uDivergence, 1);
    for (let i = 0; i < PRESSURE_ITER; i++) {
      bindTex(0, prs.read.texture); gl.uniform1i(progPressureRef.current!.uniforms.uPressure, 0);
      blit(prs.write.fbo, S, S); prs.swap();
    }

    gl.useProgram(progGradSubRef.current!.prog);
    gl.uniform2f(progGradSubRef.current!.uniforms.texelSize, 1/S, 1/S);
    bindTex(0, prs.read.texture); gl.uniform1i(progGradSubRef.current!.uniforms.uPressure, 0);
    bindTex(1, vel.read.texture); gl.uniform1i(progGradSubRef.current!.uniforms.uVelocity, 1);
    blit(vel.write.fbo, S, S); vel.swap();

    gl.useProgram(progAdvectRef.current!.prog);
    gl.uniform2f(progAdvectRef.current!.uniforms.texelSize, 1/S, 1/S);
    gl.uniform1f(progAdvectRef.current!.uniforms.dt, dt);
    gl.uniform1f(progAdvectRef.current!.uniforms.dissipation, VELOCITY_DISS);
    bindTex(0, vel.read.texture); gl.uniform1i(progAdvectRef.current!.uniforms.uVelocity, 0);
    bindTex(1, vel.read.texture); gl.uniform1i(progAdvectRef.current!.uniforms.uSource, 1);
    blit(vel.write.fbo, S, S); vel.swap();
  }, [blit, bindTex]);

  const splat = useCallback((x: number, y: number, dx: number, dy: number) => {
    const gl  = glRef.current;  if (!gl) return;
    const vel = velocityRef.current; if (!vel) return;
    const S   = SIM_RES;
    gl.useProgram(progSplatRef.current!.prog);
    gl.uniform2f(progSplatRef.current!.uniforms.texelSize, 1/S, 1/S);
    bindTex(0, vel.read.texture);
    gl.uniform1i(progSplatRef.current!.uniforms.uTarget, 0);
    gl.uniform1f(progSplatRef.current!.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height);
    gl.uniform2f(progSplatRef.current!.uniforms.point, x, y);
    gl.uniform2f(progSplatRef.current!.uniforms.velocity, dx * SPLAT_FORCE, dy * SPLAT_FORCE);
    gl.uniform1f(progSplatRef.current!.uniforms.radius, SPLAT_RADIUS / 100);
    blit(vel.write.fbo, S, S); vel.swap();
  }, [blit, bindTex]);

  // ── WebGL init ────────────────────────────────────────────────────────────
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: false, antialias: false, depth: false, stencil: false,
    }) as WebGLRenderingContext;
    if (!gl) return;
    glRef.current = gl;

    const hfExt    = gl.getExtension("OES_texture_half_float");
    gl.getExtension("OES_texture_half_float_linear");
    const halfFloat = hfExt ? hfExt.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const initProg = (frag: string) => {
      const p = makeProgram(gl, BASE_VERT, frag);
      gl.useProgram(p.prog);
      const loc = gl.getAttribLocation(p.prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      return p;
    };

    progSplatRef.current     = initProg(SPLAT_FRAG);
    progAdvectRef.current    = initProg(ADVECT_FRAG);
    progCurlRef.current      = initProg(CURL_FRAG);
    progVorticityRef.current = initProg(VORTICITY_FRAG);
    progDivRef.current       = initProg(DIVERGENCE_FRAG);
    progPressureRef.current  = initProg(PRESSURE_FRAG);
    progGradSubRef.current   = initProg(GRAD_SUB_FRAG);

    const comp = makeProgram(gl, COMPOSITE_VERT, COMPOSITE_FRAG);
    gl.useProgram(comp.prog);
    const loc = gl.getAttribLocation(comp.prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(comp.uniforms.uDispStrength, DISP_STRENGTH);
    gl.uniform1i(comp.uniforms.tFrame,    0);
    gl.uniform1i(comp.uniforms.tVelocity, 1);
    gl.uniform1f(comp.uniforms.uZoom,     ZOOM);
    gl.uniform1i(comp.uniforms.tPrev,     2);
    progCompositeRef.current = comp;

    const S = SIM_RES;
    velocityRef.current   = new DoubleFBO(gl, S, S, halfFloat);
    pressureRef.current   = new DoubleFBO(gl, S, S, halfFloat);
    divergenceRef.current = new SingleFBO(gl, S, S, halfFloat);
    curlFBORef.current    = new SingleFBO(gl, S, S, halfFloat);

    frameTextures.current = Array.from({ length: frameCount }, () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    textureReady.current = new Array(frameCount).fill(false);
  }, [frameCount]);

  // ── Texture window management ─────────────────────────────────────────────
  const getWindow = useCallback((center: number, dir: number) => {
    const behind = dir >= 0 ? WINDOW_BEHIND : WINDOW_AHEAD;
    const ahead  = dir >= 0 ? WINDOW_AHEAD  : WINDOW_BEHIND;
    return {
      lo: Math.max(0, center - behind),
      hi: Math.min(frameCount - 1, center + ahead),
    };
  }, [frameCount]);

  const evictOutOfWindow = useCallback((lo: number, hi: number) => {
    const gl = glRef.current; if (!gl) return;
    for (let i = 0; i < frameCount; i++) {
      if (i >= lo && i <= hi) continue;
      const ctrl = abortMap.current.get(i);
      if (ctrl) { ctrl.abort(); abortMap.current.delete(i); loadingSet.current.delete(i); }
      if (!textureReady.current[i]) continue;
      gl.deleteTexture(frameTextures.current[i]);
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      frameTextures.current[i] = t;
      textureReady.current[i]  = false;
    }
  }, [frameCount]);

  const fetchFrame = useCallback(async (i: number) => {
    if (textureReady.current[i] || loadingSet.current.has(i)) return;
    if (BITMAP_CACHE.has(i)) {
      const gl = glRef.current; if (!gl) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frameTextures.current[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, BITMAP_CACHE.get(i)!);
      textureReady.current[i] = true;
      return;
    }
    loadingSet.current.add(i);
    const controller = new AbortController();
    abortMap.current.set(i, controller);
    try {
      const n    = (i + 1).toString().padStart(4, "0");
      const resp = await fetch(`${folderPath}/frame_${n}.${extension}`, {
        signal: controller.signal, cache: "force-cache",
      });
      if (!resp.ok) return;
      const bitmap = await createImageBitmap(await resp.blob(), {
        resizeQuality: "medium", premultiplyAlpha: "none", colorSpaceConversion: "none",
      });
      BITMAP_CACHE.set(i, bitmap);
      const gl = glRef.current;
      if (!gl || controller.signal.aborted) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frameTextures.current[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      textureReady.current[i] = true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") console.warn(`frame ${i} failed`, err);
    } finally {
      loadingSet.current.delete(i);
      abortMap.current.delete(i);
    }
  }, [folderPath, extension]);

  const updateWindow = useCallback(async (center: number, dir: number) => {
    const { lo, hi } = getWindow(center, dir);
    evictOutOfWindow(lo, hi);
    const needed: number[] = [];
    for (let i = center; i <= hi; i++)
      if (!textureReady.current[i] && !loadingSet.current.has(i)) needed.push(i);
    for (let i = center - 1; i >= lo; i--)
      if (!textureReady.current[i] && !loadingSet.current.has(i)) needed.push(i);
    for (let b = 0; b < needed.length; b += FETCH_BATCH)
      await Promise.all(needed.slice(b, b + FETCH_BATCH).map(fetchFrame));
  }, [getWindow, evictOutOfWindow, fetchFrame]);

  const triggerNextLoopCache = useCallback(async (loopIdx: number) => {
    const nextIdx = loopIdx + 1;
    if (nextIdx >= LOOPS.length)              return;
    if (cachedUpToLoopRef.current >= nextIdx) return;
    if (bgCachingRef.current)                 return;
    bgCachingRef.current      = true;
    cachedUpToLoopRef.current = nextIdx;
    try {
      const currentLoop = LOOPS[loopIdx];
      const nextLoop    = LOOPS[nextIdx];
      const interFrames: number[] = [];
      for (let i = currentLoop.end + 1; i < nextLoop.start; i++) {
        if (!BITMAP_CACHE.has(i) && !textureReady.current[i]) interFrames.push(i);
      }
      for (let b = 0; b < interFrames.length; b += INTERLOOP_PREFETCH_BATCH) {
        if (!readyRef.current) break;
        await Promise.all(interFrames.slice(b, b + INTERLOOP_PREFETCH_BATCH).map(fetchFrame));
        await new Promise((r) => setTimeout(r, 0));
      }
      const nextLoopFrames: number[] = [];
      for (let i = nextLoop.start; i <= nextLoop.end; i++) {
        if (!BITMAP_CACHE.has(i) && !textureReady.current[i]) nextLoopFrames.push(i);
      }
      for (let b = 0; b < nextLoopFrames.length; b += INTERLOOP_PREFETCH_BATCH) {
        if (!readyRef.current) break;
        await Promise.all(nextLoopFrames.slice(b, b + INTERLOOP_PREFETCH_BATCH).map(fetchFrame));
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      bgCachingRef.current = false;
    }
  }, [fetchFrame]);

  const preloadFrames = useCallback(async () => {
    const phase1 = [0];
    for (let i = LOOPS[0].start; i <= LOOPS[0].end; i++) phase1.push(i);
    let done = 0;
    for (let b = 0; b < phase1.length; b += FETCH_BATCH) {
      await Promise.all(
        phase1.slice(b, b + FETCH_BATCH).map((i) =>
          fetchFrame(i).then(() => {
            done++;
            setLoadPct(Math.round((done / phase1.length) * 100));
          }),
        ),
      );
    }
    setLoaded(true);
    readyRef.current = true;
    await triggerNextLoopCache(0);
    for (let li = 2; li < LOOPS.length; li++) {
      if (!readyRef.current) break;
      const loop = LOOPS[li];
      const frames: number[] = [];
      for (let i = loop.start; i <= loop.end; i++) {
        if (!BITMAP_CACHE.has(i) && !textureReady.current[i]) frames.push(i);
      }
      for (let b = 0; b < frames.length; b += INTERLOOP_PREFETCH_BATCH) {
        if (!readyRef.current) break;
        await Promise.all(frames.slice(b, b + INTERLOOP_PREFETCH_BATCH).map(fetchFrame));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    for (let li = 1; li < LOOPS.length; li++) {
      if (!readyRef.current) break;
      const from = LOOPS[li - 1].end + 1;
      const to   = LOOPS[li].start;
      const frames: number[] = [];
      for (let i = from; i < to; i++) {
        if (!BITMAP_CACHE.has(i) && !textureReady.current[i]) frames.push(i);
      }
      for (let b = 0; b < frames.length; b += INTERLOOP_PREFETCH_BATCH) {
        if (!readyRef.current) break;
        await Promise.all(frames.slice(b, b + INTERLOOP_PREFETCH_BATCH).map(fetchFrame));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    trimBitmapCache(600);
  }, [frameCount, fetchFrame, triggerNextLoopCache]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const gl     = glRef.current;
    if (!canvas || !gl) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width        = window.innerWidth  * dpr;
    canvas.height       = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + "px";
    canvas.style.height = window.innerHeight + "px";
  }, []);

  // ── Stair helpers ─────────────────────────────────────────────────────────
  const runStairIn = useCallback((): Promise<void> => {
    stairBusyRef.current = true;
    return new Promise((resolve) => {
      for (let i = 0; i < STAIR_COUNT; i++) {
        setTimeout(() => {
          setStairVisible((prev) => {
            const next = [...prev]; next[i] = true; return next;
          });
          if (i === STAIR_COUNT - 1) setTimeout(resolve, STAIR_SETTLE_MS);
        }, i * STAIR_DURATION_MS);
      }
    });
  }, []);

  const runStairOut = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      for (let i = 0; i < STAIR_COUNT; i++) {
        setTimeout(() => {
          setStairVisible((prev) => {
            const next = [...prev]; next[i] = false; return next;
          });
          if (i === STAIR_COUNT - 1) {
            setTimeout(() => {
              stairBusyRef.current = false;
              resolve();
            }, STAIR_SETTLE_MS);
          }
        }, i * STAIR_DURATION_MS);
      }
    });
  }, []);

  // ── Forward transition: video → static ───────────────────────────────────
  const triggerEndTransition = useCallback(async () => {
    if (endTransitionFiredRef.current) return;
    endTransitionFiredRef.current = true;
    isTransitioningRef.current    = false;

    setContentVisible(false);

    await runStairIn();
    setShowStaticContent(true);
    await runStairOut();
  }, [runStairIn, runStairOut]);

  // ── Backward transition: static → video ──────────────────────────────────
  const triggerReturnToVideo = useCallback(async () => {
    if (returnTransitionFiredRef.current) return;
    returnTransitionFiredRef.current = true;

    await runStairIn();

    frameFloatRef.current      = LOOPS[LOOPS.length - 1].start;
    currentLoopRef.current     = LOOPS.length - 1;
    loopPlayDirRef.current     = 1;
    isTransitioningRef.current = false;
    directionRef.current       = 0;
    setShowStaticContent(false);

    endTransitionFiredRef.current    = false;
    returnTransitionFiredRef.current = false;

    await runStairOut();
    setContentVisible(true);
  }, [runStairIn, runStairOut]);

  // ── Render loop ───────────────────────────────────────────────────────────
  const startRenderLoop = useCallback(() => {
    const gl = glRef.current; if (!gl) return;
    let running = true;
    let lastT   = 0;
    let dbgTick = 0;

    const paint = (t: number) => {
      if (!running) return;
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      if (readyRef.current) {
        const f         = frameFloatRef.current;
        const inLoopIdx = LOOPS.findIndex((l) => f >= l.start && f <= l.end);

        blendRef.current = Math.min(1.0, blendRef.current + dt * 6);

        if (isTransitioningRef.current) {
          const total   = transitionTotalRef.current;
          const covered = transitionCoveredRef.current;
          const tDir    = transitionDirRef.current;

          const p0    = covered / total;
          const p1    = Math.min((covered + TRANSITION_FPS * dt) / total, 1.0);
          const eased = (easeInOut(p1) - easeInOut(p0)) * total;

          frameFloatRef.current        += tDir * eased;
          transitionCoveredRef.current  = covered + TRANSITION_FPS * dt;
          frameFloatRef.current         = Math.max(0, Math.min(frameCount - 1, frameFloatRef.current));

          const newLoopIdx    = LOOPS.findIndex((l) => frameFloatRef.current >= l.start && frameFloatRef.current <= l.end);
          const hitEnd        = frameFloatRef.current >= frameCount - 1 && tDir === 1;
          const arrivedAtLoop = newLoopIdx >= 0 && newLoopIdx !== currentLoopRef.current;

          if (hitEnd) {
            triggerEndTransition();
            requestAnimationFrame(paint);
            return;
          }

          if (arrivedAtLoop || transitionCoveredRef.current >= total) {
            frameFloatRef.current = transitionTargetRef.current;
            const landedIdx = LOOPS.findIndex(
              (l) => frameFloatRef.current >= l.start && frameFloatRef.current <= l.end
            );
            if (landedIdx >= 0) {
              currentLoopRef.current = landedIdx;
              loopPlayDirRef.current = 1;
              setActiveLoopIdx(landedIdx);
            }
            isTransitioningRef.current = false;
            directionRef.current       = 0;
            setContentVisible(true);
          }

        } else {
          if (inLoopIdx >= 0) {
            if (currentLoopRef.current !== inLoopIdx) {
              currentLoopRef.current = inLoopIdx;
              loopPlayDirRef.current = 1;
            }
            const loop = LOOPS[inLoopIdx];
            const pd   = loopPlayDirRef.current;
            frameFloatRef.current += dt * SOURCE_FPS * pd;
            if (pd === 1 && frameFloatRef.current >= loop.end) {
              frameFloatRef.current  = loop.end - (frameFloatRef.current - loop.end);
              loopPlayDirRef.current = -1;
            } else if (pd === -1 && frameFloatRef.current <= loop.start) {
              frameFloatRef.current  = loop.start + (loop.start - frameFloatRef.current);
              loopPlayDirRef.current = 1;
            }
          } else {
            frameFloatRef.current += dt * SOURCE_FPS;
            if (frameFloatRef.current >= frameCount - 1) frameFloatRef.current = frameCount - 1;
          }
        }

        if (inLoopIdx >= 0) {
          setActiveLoopIdx(inLoopIdx);
          if (!bgCachingRef.current && cachedUpToLoopRef.current < inLoopIdx + 1) {
            triggerNextLoopCache(inLoopIdx);
          }
        }

        dbgTick++;
        if (dbgTick % 10 === 0) {
          const windowDir = isTransitioningRef.current ? directionRef.current : loopPlayDirRef.current;
          updateWindow(Math.floor(frameFloatRef.current), windowDir);
        }
        if (isTransitioningRef.current) {
          const cur = Math.floor(frameFloatRef.current);
          const dir = transitionDirRef.current;
          const lookahead: number[] = [];
          for (let i = 1; i <= 30; i++) {
            const idx = cur + dir * i;
            if (idx >= 0 && idx < frameCount && !textureReady.current[idx]) lookahead.push(idx);
          }
          if (lookahead.length > 0) Promise.all(lookahead.map(fetchFrame));
        }
        if (dbgTick % 6 === 0) {
          setDebugFrame(Math.floor(frameFloatRef.current));
          const phase = isTransitioningRef.current
            ? `TRANSITION ${transitionDirRef.current > 0 ? "FWD" : "REV"} ${Math.round((transitionCoveredRef.current / transitionTotalRef.current) * 100)}%`
            : inLoopIdx >= 0
              ? `LOOP_${inLoopIdx} ${loopPlayDirRef.current > 0 ? "▶" : "◀"}  cache→${cachedUpToLoopRef.current}`
              : "AUTOPLAY";
          setDebugPhase(phase);
        }
      }

      if (dt > 0) fluidStep(dt);

      const mx = mouseNormRef.current.x - 0.5;
      const my = mouseNormRef.current.y - 0.5;
      parallaxRef.current.x += (mx * PARALLAX_STRENGTH - parallaxRef.current.x) * PARALLAX_LERP;
      parallaxRef.current.y += (-my * PARALLAX_STRENGTH - parallaxRef.current.y) * PARALLAX_LERP;

      const fi = Math.min(Math.max(Math.floor(frameFloatRef.current), 0), frameCount - 1);
      if (textureReady.current[fi] && velocityRef.current) {
        const comp = progCompositeRef.current!;
        gl.useProgram(comp.prog);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.uniform2f(comp.uniforms.uPan, parallaxRef.current.x, parallaxRef.current.y);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, frameTextures.current[fi]);
        gl.uniform1i(comp.uniforms.tFrame, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, velocityRef.current.read.texture);
        gl.uniform1i(comp.uniforms.tVelocity, 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, prevFrameTexRef.current ?? frameTextures.current[fi]);
        gl.uniform1i(comp.uniforms.tPrev, 2);
        gl.uniform1f(comp.uniforms.uBlend, blendRef.current);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      requestAnimationFrame(paint);
    };

    requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(paint); });
    return () => { running = false; };
  }, [frameCount, fluidStep, updateWindow, fetchFrame, triggerNextLoopCache, triggerEndTransition]);

  // ── Video wheel handler ───────────────────────────────────────────────────
  const handleScroll = useCallback((e: WheelEvent) => {
    if (showStaticContent)                 return;
    if (endTransitionFiredRef.current)     return;
    if (isTransitioningRef.current)        return;
    if (stairBusyRef.current)             return;

    scrollAccRef.current += e.deltaY;
    if (Math.abs(scrollAccRef.current) < SCROLL_THRESHOLD) return;
    const scrollDir = scrollAccRef.current > 0 ? 1 : -1;
    scrollAccRef.current = 0;

    const f = frameFloatRef.current;

    if (scrollDir === 1 && f < frameCount - 1) {
      const nextLoop    = LOOPS.find((l) => l.start > f);
      const targetFrame = nextLoop ? nextLoop.start : frameCount - 1;
      transitionTargetRef.current  = targetFrame;
      const distance               = targetFrame - f;
      isTransitioningRef.current   = true;
      transitionDirRef.current     = 1;
      transitionTotalRef.current   = distance;
      transitionCoveredRef.current = 0;
      directionRef.current         = 1;
      setContentVisible(false);

      const end = Math.min(frameCount - 1, Math.ceil(f + distance + WINDOW_AHEAD));
      const ahead: number[] = [];
      for (let i = Math.floor(f); i <= end; i++) ahead.push(i);
      for (let b = 0; b < ahead.length; b += 32) Promise.all(ahead.slice(b, b + 32).map(fetchFrame));

    } else if (scrollDir === -1 && f > 0) {
      const prevLoop    = [...LOOPS].reverse().find((l) => l.end < f);
      const targetFrame = prevLoop ? prevLoop.start : 0;
      const distance    = f - targetFrame;
      transitionTargetRef.current  = targetFrame;
      isTransitioningRef.current   = true;
      transitionDirRef.current     = -1;
      transitionTotalRef.current   = distance;
      transitionCoveredRef.current = 0;
      directionRef.current         = -1;
      setContentVisible(false);

      const start = Math.max(0, Math.floor(f - distance - WINDOW_AHEAD));
      const behind: number[] = [];
      for (let i = Math.ceil(f); i >= start; i--) behind.push(i);
      for (let b = 0; b < behind.length; b += 32) Promise.all(behind.slice(b, b + 32).map(fetchFrame));
    }
  }, [showStaticContent, frameCount, fetchFrame]);

  // ── Static content wheel handler ──────────────────────────────────────────
  const handleStaticScroll = useCallback((e: WheelEvent) => {
    if (!showStaticContent)                    return;
    if (stairBusyRef.current)                 return;
    if (returnTransitionFiredRef.current)      return;
    if (e.deltaY >= 0)                         return;

    const el = staticScrollRef.current;
    if (el && el.scrollTop > 0)               return;

    triggerReturnToVideo();
  }, [showStaticContent, triggerReturnToVideo]);

  // ── Mouse handler ─────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect(); if (!rect) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top)  / rect.height;
    const dx = nx - prevMouseRef.current.x;
    const dy = ny - prevMouseRef.current.y;
    prevMouseRef.current = { x: nx, y: ny };
    mouseNormRef.current = { x: nx, y: ny };
    if (Math.hypot(dx, dy) > 0.0005) splat(nx, ny, dx, dy);
  }, [splat]);

  // ── Mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    let stopRender: (() => void) | undefined;
    const init = async () => {
      initWebGL();
      resizeCanvas();
      stopRender = startRenderLoop() ?? undefined;
      window.addEventListener("resize", resizeCanvas);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("wheel", handleScroll as EventListener,       { passive: true });
      window.addEventListener("wheel", handleStaticScroll as EventListener, { passive: true });
      await preloadFrames();
    };
    init();
    return () => {
      readyRef.current = false;
      stopRender?.();
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("wheel", handleScroll as EventListener);
      window.removeEventListener("wheel", handleStaticScroll as EventListener);
      const gl = glRef.current;
      if (gl) frameTextures.current.forEach((t) => t && gl.deleteTexture(t));
    };
  }, [initWebGL, resizeCanvas, preloadFrames, startRenderLoop, handleMouseMove, handleScroll, handleStaticScroll]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .mu-stair-panel {
          position: fixed;
          top: 0;
          bottom: 0;
          z-index: 500;
          background: #000;
          transform: translateY(100%);
          transition: transform ${STAIR_SETTLE_MS}ms cubic-bezier(0.76, 0, 0.24, 1);
          will-change: transform;
          pointer-events: none;
        }
        .mu-stair-panel.visible {
          transform: translateY(0%);
        }
        .mu-header {
          position: fixed; top: 40px; left: 0; right: 0; z-index: 200;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 clamp(16px, 3vw, 40px); height: 56px;
        }
        .mu-header-left { display: flex; align-items: center; gap: 12px; }
        .mu-logo-mark {
          width: 112px; height: 48px; border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
        }
        .mu-logo-divider { width: 1px; height: 18px; background: rgba(255,255,255,0.3); }
        .mu-logo-school {
          font-size: 16px; font-weight: 600; text-transform: uppercase;
        }
        .mu-header-right { display: flex; align-items: center; gap: 16px; }
        .mu-cta {
          font-size: 14px; font-weight: 600; color: #000; background: #fff;
          border: none; border-radius: 3px; padding: 8px 16px; cursor: pointer; white-space: nowrap;
        }
        .mu-hamburger {
          display: flex; flex-direction: column; gap: 5px; cursor: pointer; padding: 10px 8px;
          background: rgba(255,255,255,0.25); backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .mu-hamburger span { display: block; width: 22px; height: 1.5px; background: rgba(255,255,255,0.8); }
        .mu-sidenav {
          position: fixed; left: 20px; top: 50%; transform: translateY(-50%);
          z-index: 200; display: flex; flex-direction: row; align-items: flex-start;
          gap: 16px; pointer-events: none;
        }
        .mu-sidenav-track-wrap { position: relative; width: 12px; align-self: stretch; flex-shrink: 0; }
        .mu-sidenav-track {
          position: absolute; left: 50%; top: 0; bottom: 0; transform: translateX(-50%);
          width: 2px; background: rgba(255,255,255,0.2); border-radius: 2px;
        }
        .mu-sidenav-indicator {
          position: absolute; left: 50%; transform: translateX(-50%);
          width: 6px; height: 40px; border-radius: 999px;
          background: rgba(255,255,255,0.85); backdrop-filter: blur(4px);
          transition: top 0.4s cubic-bezier(0.4, 0, 0.2, 1); margin-top: -20px;
        }
        .mu-sidenav-item { display: flex; align-items: center; pointer-events: auto; }
        .mu-sidenav-label {
          font-size: 14px; font-weight: 600; color: #000;
          transition: background-color 0.3s, color 0.3s; white-space: nowrap;
          padding: 6px 12px; background-color: rgba(255,255,255,0.45);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          border-radius: 4px; cursor: pointer; user-select: none;
        }
        .mu-sidenav-item:hover .mu-sidenav-label { background-color: rgba(255,255,255,0.7); }
        .mu-sidenav-label.active {
          color: #000; background-color: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        }
        .mu-collab {
          position: fixed; right: 0; top: 50%;
          transform: translateY(-50%) rotate(90deg); transform-origin: center center;
          z-index: 200; font-size: 0.6rem; font-weight: 500;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); white-space: nowrap;
          pointer-events: none; margin-right: -28px;
        }
        .mu-loop-content {
          opacity: ${contentVisible ? 1 : 0};
          transition: opacity ${CONTENT_FADE_MS}ms ease;
        }
        .loop-eyebrow {
          font-size: 0.7rem; font-weight: 500; letter-spacing: 0.32em;
          text-transform: uppercase; color: rgba(255,255,255,0.45); margin: 0 0 0.6em 0; min-height: 1em;
        }
        .loop-heading {
          font-family: 'Anton', sans-serif;
          font-size: clamp(2.2rem, 5vw, 4.5rem); letter-spacing: 0.04em;
          text-transform: uppercase; color: #fff; line-height: 1.05; margin: 0;
          text-shadow: 0 2px 24px rgba(0,0,0,0.45);
        }
        .loop-description {
          font-size: clamp(0.85rem, 1.1vw, 1.05rem); font-weight: 300;
          letter-spacing: 0.01em; line-height: 1.5; color: rgba(255,255,255,0.8);
          text-align: right; margin: 0; text-shadow: 0 2px 20px rgba(0,0,0,0.5);
        }
      `}</style>

      {/* ── STAIR PANELS ── */}
      {Array.from({ length: STAIR_COUNT }, (_, i) => (
        <div
          key={i}
          className={`mu-stair-panel${stairVisible[i] ? " visible" : ""}`}
          style={{
            left:  `${(i / STAIR_COUNT) * 100}%`,
            width: `${100 / STAIR_COUNT}%`,
          }}
        />
      ))}

      {/* ── HEADER ── */}
      <header className="mu-header">
        <div className="mu-header-left">
          <div className="mu-logo-mark">
            <img src="https://cdn.unionstack.link/uploads/18062026/v1/muLogo.svg" alt="muLogo" />
          </div>
          <div className="mu-logo-divider" />
          <span className="mu-logo-school">School of BioScience</span>
        </div>
        <div className="mu-header-right">
          <button className="mu-cta">Register Now</button>
          <div className="mu-hamburger"><span /><span /><span /></div>
        </div>
      </header>

      {/* ── SIDENAV ── */}
      <nav className="mu-sidenav">
        <div className="mu-sidenav-track-wrap">
          <div className="mu-sidenav-track" />
          <div className="mu-sidenav-indicator" style={{ top: `${pillTop}px` }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {NAV_LABELS.map((label, i) => {
            const navIdx    = getNavIdx(activeLoopIdx, showStaticContent);
            const navActive = navIdx === i;
            return (
              <div
                key={label}
                ref={(el) => { navItemRefs.current[i] = el; }}
                className="mu-sidenav-item"
           onClick={() => {
  // ── From static content → jump to a video loop ──────────────────
  if (showStaticContent) {
    if (i >= 4) return;
    const loopIdx = NAV_LOOP_MAP[i];
    if (loopIdx === undefined) return;
    if (returnTransitionFiredRef.current) return;
    returnTransitionFiredRef.current = true;
    runStairIn().then(async () => {
      frameFloatRef.current      = LOOPS[loopIdx].start;
      currentLoopRef.current     = loopIdx;
      loopPlayDirRef.current     = 1;
      isTransitioningRef.current = false;
      directionRef.current       = 0;
      setShowStaticContent(false);
      endTransitionFiredRef.current    = false;
      returnTransitionFiredRef.current = false;
      await runStairOut();
      setContentVisible(true);
    });
    return;
  }

  // ── From video → Speakers triggers end transition ────────────────
  if (i === 4) {
    triggerEndTransition();
    return;
  }

  // ── From video → another video loop ─────────────────────────────
  if (endTransitionFiredRef.current) return;
  const loopIdx = NAV_LOOP_MAP[i];
  if (loopIdx === undefined) return;
  setContentVisible(false);
  frameFloatRef.current      = LOOPS[loopIdx].start;
  currentLoopRef.current     = loopIdx;
  loopPlayDirRef.current     = 1;
  isTransitioningRef.current = false;
  directionRef.current       = 0;
  window.setTimeout(() => setContentVisible(true), CONTENT_FADE_MS);
}}
                style={{ cursor: "pointer" }}
              >
                <span className={`mu-sidenav-label${navActive ? " active" : ""}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </nav>



      {/* ── VIDEO LAYER — always mounted ── */}
      <div
        ref={wrapperRef}
        style={{
          position: "fixed", inset: 0,
          width: "100vw", height: "100vh",
          overflow: "hidden", background: "#000",
          zIndex: showStaticContent ? 5 : 10,
          visibility: showStaticContent ? "hidden" : "visible",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }}
        />

        {(() => {
          const C = activeLoopIdx >= 0 ? LOOP_CONTENT[activeLoopIdx]?.component : null;
          return C ? (
            <div className="mu-loop-content fixed inset-0 z-30 pointer-events-none"><C /></div>
          ) : null;
        })()}

        {/* DEBUG — remove before prod */}
        <div style={{
          position: "fixed", top: 64, left: 16, zIndex: 999,
          background: "rgba(0,0,0,0.65)", color: "#00ff88",
          fontFamily: "monospace", fontSize: "13px",
          padding: "6px 12px", borderRadius: "4px", pointerEvents: "none",
        }}>
          frame {debugFrame} / {frameCount} — {debugPhase}
        </div>

        {/* Loading screen */}
        {!loaded && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100, background: "#000",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "2rem",
          }}>
            <div style={{
              width: "260px", height: "1px", background: "rgba(255,255,255,0.12)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0, background: "#fff",
                transformOrigin: "left", transform: `scaleX(${loadPct / 100})`,
                transition: "transform 0.3s ease",
              }} />
            </div>
            <p style={{
              fontFamily: '"Anton", sans-serif', fontSize: "0.75rem",
              letterSpacing: "0.3em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)", margin: 0,
            }}>
              {loadPct < 100 ? `Loading — ${loadPct}%` : "Starting…"}
            </p>
          </div>
        )}
      </div>

      {/* ── STATIC CONTENT LAYER ── */}
      <div
        ref={staticScrollRef}
        style={{
          position: "fixed", inset: 0,
          width: "100vw", height: "100vh",
          overflowY: "auto", overflowX: "hidden",
          background: "#040201",
          zIndex: showStaticContent ? 10 : 5,
          display: showStaticContent ? "block" : "none",
          isolation: "isolate",
        }}
      >
        <StarfieldBackground />

        <section style={{ position: "relative", width: "100vw", minHeight: "auto", zIndex: 1, overflow: "visible" }}>
          <Loop6 />
        </section>
        <section style={{ position: "relative", width: "100vw", minHeight: "100vh", zIndex: 1 }}>
          <Loop8 />
        </section>
        <section style={{ position: "relative", width: "100vw", minHeight: "100vh", zIndex: 1 }}>
          <Loop9 />
        </section>
      </div>
    </>
  );
}