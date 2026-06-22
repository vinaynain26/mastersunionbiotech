'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { gsap } from 'gsap'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Speaker {
  name: string
  title: string
  img: string
}

interface Logo {
  name: string
  src: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const SPEAKER_IMG = 'https://cdn.unionstack.link/uploads/22062026/v1/speaker.png'
const LOGO_IMG = 'https://cdn.unionstack.link/uploads/22062026/v1/Box.png'

const SPEAKERS_ROW1: Speaker[] = [
  { name: 'Jennifer Doudna', title: 'Nobel Laureate', img: SPEAKER_IMG },
  { name: 'Kiran Mazumdar Shaw', title: 'Executive Chairperson, Biocon', img: SPEAKER_IMG },
  { name: 'Soumya Swaminathan', title: 'Former Chief Scientist, WHO', img: SPEAKER_IMG },
  { name: 'Raghunath Mashelkar', title: 'Former DG, CSIR', img: SPEAKER_IMG },
  { name: 'Vijay Chandru', title: 'Co-founder, Strand Life Sciences', img: SPEAKER_IMG },
  { name: 'Priya Chandran', title: 'CEO, GenomicsAI', img: SPEAKER_IMG },
]

const SPEAKERS_ROW2: Speaker[] = [
  { name: 'Gagandeep Kang', title: 'Virologist & FRS Fellow', img: SPEAKER_IMG },
  { name: 'Sheuli Mitra', title: 'VP, Sanofi Global', img: SPEAKER_IMG },
  { name: 'Arvind Nair', title: 'Partner, Sequoia Capital', img: SPEAKER_IMG },
  { name: 'Tarun Khanna', title: 'Professor, Harvard Business', img: SPEAKER_IMG },
  { name: 'Rohini Godbole', title: 'Physicist, IISc Bangalore', img: SPEAKER_IMG },
  { name: 'Siddharth Pai', title: 'Founding Partner, 3one4 Capital', img: SPEAKER_IMG },
]

const LOGOS: Logo[] = [
  { name: 'Deloitte', src: LOGO_IMG },
  { name: 'Google', src: LOGO_IMG },
  { name: 'Infosys', src: LOGO_IMG },
  { name: 'Cognizant', src: LOGO_IMG },
  { name: 'Biocon', src: LOGO_IMG },
  { name: 'Strand', src: LOGO_IMG },
]

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_W = 470
const CARD_GAP = 20
const STEP = CARD_W + CARD_GAP
const TOTAL = SPEAKERS_ROW1.length
const AUTOPLAY_MS = 3200
const TRANSITION_S = 0.68
const CLONE_COUNT = TOTAL

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildTrack<T>(items: T[]): T[] {
  return [...items.slice(-CLONE_COUNT), ...items, ...items.slice(0, CLONE_COUNT)]
}

function xForVirtual(v: number) {
  return -v * STEP
}

// ─── Speaker Card ─────────────────────────────────────────────────────────────
function SpeakerCard({ speaker, isCenter }: { speaker: Speaker; isCenter: boolean }) {
  return (
    <div
      className="flex-shrink-0 overflow-hidden border transition-all duration-500"
      style={{
        width: CARD_W,
        marginRight: CARD_GAP,
        border: isCenter
          ? '1.5px solid rgba(255,255,255,0.25)'
          : '1.5px solid rgba(255,255,255,0.06)',
        background: isCenter
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(255,255,255,0.02)',
        opacity: isCenter ? 1 : 0.45,
        transform: isCenter ? 'scale(1)' : 'scale(0.92)',
      }}
    >
      <div className="flex items-center gap-5 px-6 py-5">
        <div
          className="flex-shrink-0 transition-all duration-500"
          style={{
            width: isCenter ? 230 : 172,
            height: isCenter ? 215 : 161,
            backgroundImage: `url(${speaker.img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        />

        <div className="flex flex-col">
          <p
            className="font-sans font-semibold uppercase tracking-wide text-white leading-tight"
            style={{ fontSize: isCenter ? 18 : 14 }}
          >
            {speaker.name}
          </p>
          <div className="mt-1 mb-2 w-7 h-0.5 rounded-full bg-[#C9A84C]" />
          <p className="font-sans uppercase tracking-widest text-white/50 text-[10px]">
            {speaker.title}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Logo Row ─────────────────────────────────────────────────────────────────
function LogoRow({ activeReal }: { activeReal: number }) {
  const SPACING = 160

  return (
    <div
      className="relative w-full h-[100px]"
      style={{ perspective: '1200px', perspectiveOrigin: '50% 50%' }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 260,
          height: 90,
          background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.20) 0%, transparent 70%)',
        }}
      />

      {LOGOS.map((logo, i) => {
        let offset = i - activeReal
        if (offset > TOTAL / 2) offset -= TOTAL
        if (offset < -TOTAL / 2) offset += TOTAL

        const abs = Math.abs(offset)
        if (abs > 2) return null

        const tx = offset === 0 ? 0 : Math.sign(offset) * (abs === 1 ? SPACING : SPACING * 1.5)
        const ty = -(abs * abs) * 12
        const rotateY = offset * 30
        const scale = 1 - abs * 0.14
        const opacity = [1, 0.7, 0.28][abs]

        return (
          <div
            key={logo.name}
            className="absolute flex items-center justify-center"
            style={{
              left: '50%',
              top: '50%',
              width: 200,
              height: 56,
              zIndex: 10 - abs,
              opacity,
              transition: `all ${TRANSITION_S}s cubic-bezier(0.4,0,0.2,1)`,
              transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotateY(${rotateY}deg) scale(${scale})`,
              transformStyle: 'preserve-3d',
            }}
          >
            <img
              src={logo.src}
              alt={logo.name}
              className="h-[94px] w-[224px] object-contain opacity-80"
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SpeakerSwiper() {
  const [virtualIndex, setVirtualIndex] = useState(CLONE_COUNT)
  const virtualRef = useRef(CLONE_COUNT)

  const trackR1Ref = useRef<HTMLDivElement>(null)
  const trackR2Ref = useRef<HTMLDivElement>(null)
  const autoRef = useRef<NodeJS.Timeout | null>(null)

  const dragStart = useRef<number | null>(null)
  const isDragging = useRef(false)
  const animating = useRef(false)

  const track1 = buildTrack(SPEAKERS_ROW1)
  const track2 = buildTrack(SPEAKERS_ROW2)
  const realIndex = ((virtualIndex - CLONE_COUNT) % TOTAL + TOTAL) % TOTAL

  const silentJump = useCallback((from: number) => {
    let v = from
    if (v < CLONE_COUNT) v += TOTAL
    if (v >= CLONE_COUNT + TOTAL) v -= TOTAL
    if (v === from) return

    gsap.set([trackR1Ref.current, trackR2Ref.current], { x: xForVirtual(v) })
    virtualRef.current = v
    setVirtualIndex(v)
  }, [])

  const slideTo = useCallback(
    (next: number) => {
      if (animating.current) return
      animating.current = true
      virtualRef.current = next
      setVirtualIndex(next)

      gsap.to([trackR1Ref.current, trackR2Ref.current], {
        x: xForVirtual(next),
        duration: TRANSITION_S,
        ease: 'power3.inOut',
        onComplete: () => {
          silentJump(next)
          animating.current = false
        },
      })
    },
    [silentJump]
  )

  const scheduleNext = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current)
    autoRef.current = setTimeout(() => slideTo(virtualRef.current + 1), AUTOPLAY_MS)
  }, [slideTo])

  useEffect(() => {
    gsap.set([trackR1Ref.current, trackR2Ref.current], { x: xForVirtual(CLONE_COUNT) })
    scheduleNext()
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current)
    }
  }, [scheduleNext])

  useEffect(() => {
    scheduleNext()
  }, [virtualIndex, scheduleNext])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStart.current = e.clientX
    isDragging.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStart.current === null) return
    if (Math.abs(e.clientX - dragStart.current) > 6) isDragging.current = true
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStart.current === null) return
      const delta = e.clientX - dragStart.current
      dragStart.current = null
      if (!isDragging.current || Math.abs(delta) < 30) return

      slideTo(virtualRef.current + (delta < 0 ? 1 : -1))
      scheduleNext()
    },
    [slideTo, scheduleNext]
  )

  const pp = { onPointerDown, onPointerMove, onPointerUp }

  return (
    <section className="relative z-40 w-full flex flex-col items-center py-8 select-none pointer-events-auto">
      {/* Speaker Row 1 - Increased height to prevent cropping */}
      <div className="relative w-full h-[240px] overflow-hidden cursor-grab" {...pp}>
        <div
          ref={trackR1Ref}
          className="absolute top-1/2 -translate-y-1/2 flex items-center will-change-transform"
          style={{ left: `calc(50% - ${CARD_W / 2}px)` }}
        >
          {track1.map((s, i) => (
            <SpeakerCard key={`r1-${i}`} speaker={s} isCenter={i === virtualIndex} />
          ))}
        </div>
      </div>

      {/* Logo Row - Reduced gap */}
      <div
        className="relative w-full cursor-grab"
        {...pp}
        style={{ margin: '20px 0' }}   // ← Smaller margin
      >
        <LogoRow activeReal={realIndex} />
      </div>

      {/* Speaker Row 2 - Increased height to prevent cropping */}
      <div className="relative w-full h-[240px] overflow-hidden cursor-grab" {...pp}>
        <div
          ref={trackR2Ref}
          className="absolute top-1/2 -translate-y-1/2 flex items-center will-change-transform"
          style={{ left: `calc(50% - ${CARD_W / 2}px)` }}
        >
          {track2.map((s, i) => (
            <SpeakerCard key={`r2-${i}`} speaker={s} isCenter={i === virtualIndex} />
          ))}
        </div>
      </div>

      {/* Dots + Arrows */}
      <div className="flex items-center gap-6 mt-6 hidden">
        <button
          onClick={() => {
            if (!animating.current) {
              slideTo(virtualRef.current - 1)
              scheduleNext()
            }
          }}
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 text-xl hover:text-white hover:border-white/50 transition-all"
        >
          ‹
        </button>

        <div className="flex gap-2">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                slideTo(CLONE_COUNT + i)
                scheduleNext()
              }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === realIndex ? 20 : 6,
                height: 6,
                background: i === realIndex ? '#C9A84C' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => {
            if (!animating.current) {
              slideTo(virtualRef.current + 1)
              scheduleNext()
            }
          }}
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 text-xl hover:text-white hover:border-white/50 transition-all"
        >
          ›
        </button>
      </div>
    </section>
  )
}