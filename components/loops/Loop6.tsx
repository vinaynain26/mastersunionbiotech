'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

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
const LOGO_IMG    = 'https://cdn.unionstack.link/uploads/22062026/v1/Box.png'

const SPEAKERS_ROW1: Speaker[] = [
  { name: 'Jennifer Doudna',     title: 'Nobel Laureate',                   img: SPEAKER_IMG },
  { name: 'Kiran Mazumdar Shaw', title: 'Executive Chairperson, Biocon',    img: SPEAKER_IMG },
  { name: 'Soumya Swaminathan',  title: 'Former Chief Scientist, WHO',      img: SPEAKER_IMG },
  { name: 'Raghunath Mashelkar', title: 'Former DG, CSIR',                 img: SPEAKER_IMG },
  { name: 'Vijay Chandru',       title: 'Co-founder, Strand Life Sciences', img: SPEAKER_IMG },
  { name: 'Priya Chandran',      title: 'CEO, GenomicsAI',                 img: SPEAKER_IMG },
]

const SPEAKERS_ROW2: Speaker[] = [
  { name: 'Gagandeep Kang',  title: 'Virologist & FRS Fellow',        img: SPEAKER_IMG },
  { name: 'Sheuli Mitra',    title: 'VP, Sanofi Global',              img: SPEAKER_IMG },
  { name: 'Arvind Nair',     title: 'Partner, Sequoia Capital',       img: SPEAKER_IMG },
  { name: 'Tarun Khanna',    title: 'Professor, Harvard Business',    img: SPEAKER_IMG },
  { name: 'Rohini Godbole',  title: 'Physicist, IISc Bangalore',      img: SPEAKER_IMG },
  { name: 'Siddharth Pai',   title: 'Founding Partner, 3one4 Capital',img: SPEAKER_IMG },
]

const LOGOS: Logo[] = [
  { name: 'Deloitte',  src: LOGO_IMG },
  { name: 'Google',    src: LOGO_IMG },
  { name: 'Infosys',   src: LOGO_IMG },
  { name: 'Cognizant', src: LOGO_IMG },
  { name: 'Biocon',    src: LOGO_IMG },
  { name: 'Strand',    src: LOGO_IMG },
]

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_W        = 470
const CARD_GAP      = 20
const STEP          = CARD_W + CARD_GAP
const TOTAL         = SPEAKERS_ROW1.length
const CLONE_COUNT   = TOTAL
const AUTOPLAY_MS   = 3200
const TRANSITION_MS = 680

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildTrack<T>(items: T[]): T[] {
  return [...items.slice(-CLONE_COUNT), ...items, ...items.slice(0, CLONE_COUNT)]
}

// Pure CSS calc() — works even when parent is display:none at mount time
function xForVirtual(v: number): string {
  return `calc(50vw - ${CARD_W / 2}px - ${v * STEP}px)`
}

// ─── Speaker Card ─────────────────────────────────────────────────────────────
function SpeakerCard({ speaker, isCenter }: { speaker: Speaker; isCenter: boolean }) {
  return (
    <div
      className="flex-shrink-0 overflow-hidden transition-all duration-500 rounded-lg"
      style={{
        width: CARD_W,
        marginRight: CARD_GAP,
        border: isCenter
          ? '1.5px solid rgba(255,255,255,0.06)'
          : '1.5px solid rgba(255,255,255,0.06)',
        background: isCenter ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
        opacity: isCenter ? 1 : 0.45,
        transform: isCenter ? 'scale(1)' : 'scale(0.92)',
         backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-5  ">
        <div
          className="flex-shrink-0 transition-all duration-500"
          style={{
            width: isCenter ? 230 : 230,
            height: isCenter ? 215 : 215,
            backgroundImage: `url(${speaker.img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        />
        <div className="flex flex-col">
          <div className="mt-1 mb-2 w-7 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #D07D41 0%, rgba(221, 138, 66, 0) 100%)' }} />
          <p
            className="font-sans font-semibold uppercase tracking-wide text-white leading-none"
            style={{ fontSize: isCenter ? 32 : 24 }}
          >
            {speaker.name}
          </p>

          <p className="font-sans uppercase tracking-[8%] text-[#FFFFFF] text-[12px] mt-4 ">
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
      className="relative w-full h-[70px] ml-16"
      style={{ perspective: '1200px', perspectiveOrigin: '50% 50%' }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none "
        style={{
          width: 260,
          height: 90,
          
        }}
      />
      {LOGOS.map((logo, i) => {
        let offset = i - activeReal
        if (offset > TOTAL / 2)  offset -= TOTAL
        if (offset < -TOTAL / 2) offset += TOTAL
        const abs     = Math.abs(offset)
        if (abs > 2) return null
        const tx      = offset === 0 ? 0 : Math.sign(offset) * (abs === 1 ? SPACING : SPACING * 1.5)
        const ty      = -(abs * abs) * 12
        const rotateY = offset * 30
        const scale   = 1 - abs * 0.14
        const opacity = ([1, 0.7, 0.28] as const)[abs]
        return (
          <div
            key={logo.name}
            className="absolute flex items-center justify-center"
            style={{
              left: '50%', top: '50%',
              width: 200, height: 56,
              zIndex: 10 - abs, opacity,
              transition: `all ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
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

// ─── Speaker Row ─────────────────────────────────────────────────────────────
function SpeakerRow({
  track,
  virtualIndex,
  prefix,
  pointerProps,
}: {
  track: Speaker[]
  virtualIndex: number
  prefix: string
  pointerProps: React.HTMLAttributes<HTMLDivElement>
}) {
  return (
    <div className="relative w-full h-[215px] overflow-hidden cursor-grab ml-55 my-8 " {...pointerProps}>
      <div
        className="absolute top-1/2 flex items-center will-change-transform"
        style={{
          // Pure CSS calc keeps position correct even when mounted inside display:none
          transform: `translateY(-50%) translateX(${xForVirtual(virtualIndex)})`,
          transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.76, 0, 0.24, 1)`,
        }}
      >
        {track.map((s, i) => (
          <SpeakerCard key={`${prefix}-${i}`} speaker={s} isCenter={i === virtualIndex} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SpeakerSwiper() {
  const [virtualIndex, setVirtualIndex] = useState(CLONE_COUNT)
  const virtualRef = useRef(CLONE_COUNT)
  const animating  = useRef(false)
  const autoRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dragStartX = useRef<number | null>(null)
  const isDragging = useRef(false)

  const track1    = buildTrack(SPEAKERS_ROW1)
  const track2    = buildTrack(SPEAKERS_ROW2)
  const realIndex = ((virtualIndex - CLONE_COUNT) % TOTAL + TOTAL) % TOTAL

  // ── Slide ─────────────────────────────────────────────────────────────────
  const slideTo = useCallback((next: number) => {
    if (animating.current) return
    animating.current  = true
    virtualRef.current = next
    setVirtualIndex(next)

    setTimeout(() => {
      // Silent jump back into real range after transition completes
      let v = next
      if (v < CLONE_COUNT)          v += TOTAL
      if (v >= CLONE_COUNT + TOTAL) v -= TOTAL
      if (v !== next) {
        virtualRef.current = v
        setVirtualIndex(v)
      }
      animating.current = false
    }, TRANSITION_MS + 20)
  }, [])

  // ── Autoplay ──────────────────────────────────────────────────────────────
  const scheduleNext = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current)
    autoRef.current = setTimeout(() => slideTo(virtualRef.current + 1), AUTOPLAY_MS)
  }, [slideTo])

  useEffect(() => {
    scheduleNext()
    return () => { if (autoRef.current) clearTimeout(autoRef.current) }
  }, [scheduleNext])

  useEffect(() => { scheduleNext() }, [virtualIndex, scheduleNext])

  // ── Pointer ───────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStartX.current = e.clientX
    isDragging.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    if (Math.abs(e.clientX - dragStartX.current) > 6) isDragging.current = true
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    const delta = e.clientX - dragStartX.current
    dragStartX.current = null
    if (!isDragging.current || Math.abs(delta) < 30) return
    slideTo(virtualRef.current + (delta < 0 ? 1 : -1))
    scheduleNext()
  }, [slideTo, scheduleNext])

  const pp = { onPointerDown, onPointerMove, onPointerUp }

  return (
    <section className="relative w-full flex flex-col items-center py-8 mt-10 select-none pointer-events-auto h-full font-sans">
      <SpeakerRow track={track1} virtualIndex={virtualIndex} prefix="r1" pointerProps={pp} />

      <div className="relative w-full cursor-grab" style={{ margin: '20px 0' }} {...pp}>
        <LogoRow activeReal={realIndex} />
      </div>

      <SpeakerRow track={track2} virtualIndex={virtualIndex} prefix="r2" pointerProps={pp} />

      {/* Dots + Arrows (hidden) */}
      <div className="flex items-center gap-6 mt-6 hidden">
        <button
          onClick={() => { if (!animating.current) { slideTo(virtualRef.current - 1); scheduleNext() } }}
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 text-xl hover:text-white hover:border-white/50 transition-all"
        >‹</button>

        <div className="flex gap-2">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              onClick={() => { slideTo(CLONE_COUNT + i); scheduleNext() }}
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
          onClick={() => { if (!animating.current) { slideTo(virtualRef.current + 1); scheduleNext() } }}
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 text-xl hover:text-white hover:border-white/50 transition-all"
        >›</button>
      </div>
    </section>
  )
}