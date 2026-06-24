'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

export default function Loop0() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const descRef    = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!headingRef.current || !descRef.current) return

    const headingSplit = new SplitText(headingRef.current, { type: 'chars' })
    const descSplit    = new SplitText(descRef.current,    { type: 'chars' })

    gsap.fromTo(headingSplit.chars,
      { opacity: 0, filter: 'blur(20px)', y: -24 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 1, ease: 'power3.out',
        stagger: { each: 0.035 } }
    )
    gsap.fromTo(descSplit.chars,
      { opacity: 0, filter: 'blur(12px)', y: 12 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.8, ease: 'power3.out',
        stagger: { each: 0.015 }, delay: 0.2 }
    )

    return () => {
      headingSplit.revert()
      descSplit.revert()
    }
  }, [])

  return (
    <div className="relative flex items-end h-full w-full justify-between pl-50 pr-20 pb-20 overflow-visible">

      {/* Hero content */}
      <div className="heroContent">
        <h2
          ref={headingRef}
          className="font-sans font-semibold text-[48px] uppercase text-white leading-[1.05]"
        >
          THE NEXT GENE
        </h2>
        <p
          ref={descRef}
          className="font-sans text-[20px] font-regular text-white/50"
        >
          Shaping India&apos;s bio-revolution.
        </p>
      </div>

      {/* Timings card */}
      <div className="timings flex backdrop-blur-lg bg-white/8 text-white justify-evenly gap-10 items-center px-8 py-5 w-132 rounded-lg">
        <div className="time">
          <div className="subHead font-sans text-[12px] uppercase">Saturday</div>
          <div className="day font-sans font-semibold text-[20px]">19 Sept 2026</div>
        </div>
        <div className="location">
          <div className="subHead font-sans text-[12px] uppercase">Masters&apos; Union Campus</div>
          <div className="locationPoint font-sans font-semibold text-[20px]">DLF Cyberpark, Gurugram</div>
        </div>
      </div>

      {/* Collaborators side indicator */}
<div
  className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center"
  style={{ marginRight: '-1px' }}
>
  <div className="w-px bg-white/20" style={{ height: '250px' , marginTop:'10px'}} />

  <p
    className="uppercase font-sans text-[12px] font-semibold whitespace-nowrap bg-white text-black px-3 py-[6px]"
    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
  >
    Collaborators
  </p>

  <div className="w-px bg-white/20" style={{ height: '250px' }} />
</div>

    </div>
  )
}