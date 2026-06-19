'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

export default function Loop3() {
  const eyebrowRef = useRef<HTMLParagraphElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const descRef    = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!eyebrowRef.current || !headingRef.current || !descRef.current) return

    const eyebrowSplit = new SplitText(eyebrowRef.current, { type: 'chars' })
    const headingSplit = new SplitText(headingRef.current, { type: 'chars' })
    const descSplit    = new SplitText(descRef.current,    { type: 'chars' })

    gsap.fromTo(eyebrowSplit.chars,
      { opacity: 0, filter: 'blur(8px)', y: -10 },
      { opacity: 1, filter: 'blur(0px)', y: 0,
        duration: 0.6, ease: 'power3.out',
        stagger: { each: 0.02 } }
    )
    gsap.fromTo(headingSplit.chars,
      { opacity: 0, filter: 'blur(20px)', y: -24 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 1, ease: 'power3.out',
        stagger: { each: 0.035 }, delay: 0.15 }
    )
    gsap.fromTo(descSplit.chars,
      { opacity: 0, filter: 'blur(12px)', y: 12 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.8, ease: 'power3.out',
        stagger: { each: 0.015 }, delay: 0.35 }
    )

    return () => {
      eyebrowSplit.revert()
      headingSplit.revert()
      descSplit.revert()
    }
  }, [])

  return (
    <>
      {/* heading — bottom left */}
      <div className="absolute bottom-[80px] left-[13%] max-w-[50vw]">
        <p
          ref={eyebrowRef}
          className="font-['Space_Grotesk'] text-xs tracking-[0.32em] uppercase text-white/45 mb-3"
        >

        </p>
        <h2
          ref={headingRef}
          className=" text-[40px]   text-white leading-[100%] font-semibold left-[10%]"
        >
          Discover the Science <br></br> Behind Life
        </h2>
      </div>

      {/* description — bottom right */}
      <div className="absolute bottom-20 right-[5%] max-w-[370px]">
        <p
          ref={descRef}
          className=" text-[24px] font-semibold leading-[100%] text-white"
        >
          Explore the breakthroughs,<br></br> technologies, and  builds shaping the future of life sciences.
        </p>
      </div>
    </>
  )
}