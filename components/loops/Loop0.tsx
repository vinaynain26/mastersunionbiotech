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
    <div className="absolute bottom-25 left-50  flex w-275  justify-between">
      <div className="heroContent">


      <h2
        ref={headingRef}
        className="font-sans font-semibold text-[48px] uppercase  text-white leading-[1.05]"
      >
        THE NEXT GENE
      </h2>
      <p
        ref={descRef}
        className="font-sans text-[20px] font-regular text-white/50 mt-3"
      >
        Shaping India&apos;s bio-revolution.
      </p>
      </div>
      <div className="timings flex  backdrop-blur-lg bg-white/8  text-white justify-evenly gap-10 items-center px-8 py-5 w-132 rounded-lg  ">
        <div className="time ">
          <div className="subHead font-sans text-[12px] uppercase ">Saturday</div>
          <div className="day font-sans font-semibold text-[20px]">19 Sept 2026</div>
        </div>
        <div className="location">
          <div className="subHead font-sans text-[12px] uppercase">Masters' Union Campus</div>
          <div className="locationPoint font-sans font-semibold text-[20px]">DLF Cyberpark, Gurugram</div>
        </div>
      </div>
    </div>
  )
}