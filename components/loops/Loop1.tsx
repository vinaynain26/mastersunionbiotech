'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

export default function Loop1() {
  const eyebrowRef = useRef<HTMLParagraphElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!headingRef.current || !eyebrowRef.current) return

    const eyebrowSplit = new SplitText(eyebrowRef.current, { type: 'chars' })
    const headingSplit = new SplitText(headingRef.current, { type: 'chars' })

    gsap.fromTo(eyebrowSplit.chars,
      { opacity: 0, filter: 'blur(6px)', y: -6 },
      { opacity: 1, filter: 'blur(0px)', y: 0,
        duration: 0.3, ease: 'power2.out',
        stagger: { each: 0.012 } }
    )
    gsap.fromTo(headingSplit.chars,
      { opacity: 0, filter: 'blur(12px)', y: -14 },
      { opacity: 1, filter: 'blur(0px)', y: 0,
        duration: 0.5, ease: 'power2.out',
        stagger: { each: 0.015 }, delay: 0.08 }
    )

    return () => {
      eyebrowSplit.revert()
      headingSplit.revert()
    }
  }, [])

  return (
    <div className="absolute top-[170px] left-1/2 -translate-x-1/2">
      <p
        ref={eyebrowRef}
        className="text-xs tracking-[0.32em] uppercase text-white/45 mb-3"
      >
      </p>
      <h2
        ref={headingRef}
        className="font-sans text-[36px] font-semibold w-[80vw] text-center text-white leading-[100%]"
      >
        13.8 billion years ago, the universe took its first<br /> breath. And the story of biosciences began.
      </h2>
    </div>
  )
}