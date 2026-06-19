'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

export default function Loop2() {
  const eyebrowRef = useRef<HTMLParagraphElement>(null)
  const leftRef    = useRef<HTMLParagraphElement>(null)
  const rightRef   = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!eyebrowRef.current || !leftRef.current || !rightRef.current) return

    const eyebrowSplit = new SplitText(eyebrowRef.current, { type: 'chars' })
    const leftSplit    = new SplitText(leftRef.current,    { type: 'chars' })
    const rightSplit   = new SplitText(rightRef.current,   { type: 'chars' })

    gsap.fromTo(eyebrowSplit.chars,
      { opacity: 0, filter: 'blur(8px)', y: -10 },
      { opacity: 1, filter: 'blur(0px)', y: 0,
        duration: 0.6, ease: 'power3.out',
        stagger: { each: 0.02 } }
    )
    gsap.fromTo(leftSplit.chars,
      { opacity: 0, filter: 'blur(12px)', y: 12 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.9, ease: 'power3.out',
        stagger: { each: 0.018 }, delay: 0.2 }
    )
    gsap.fromTo(rightSplit.chars,
      { opacity: 0, filter: 'blur(12px)', y: 12 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.9, ease: 'power3.out',
        stagger: { each: 0.018 }, delay: 0.35 }
    )

    return () => {
      eyebrowSplit.revert()
      leftSplit.revert()
      rightSplit.revert()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <p
        ref={eyebrowRef}
        className="absolute top-[5%] left-1/2 -translate-x-1/2 font-['Space_Grotesk'] text-xs tracking-[0.32em] uppercase text-white/45"
      >
      </p>

      <div className="absolute bottom-[17%] left-40 right-30 flex justify-between  text-[24px] leading-[100%] text-white/85 font-light font-semibold">
        <p ref={leftRef}>
          From stardust came the elements.<br />
          Nature engineered them into life.
        </p>
        <p ref={rightRef}>
          And from life came the questions<br></br> BioScience seeks to answer.
        </p>
      </div>
    </div>
  )
}