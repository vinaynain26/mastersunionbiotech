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
      <div className="absolute top-[15%] left-[15%] max-w-[50vw]">
        <p
          ref={eyebrowRef}
          className="font-['Space_Grotesk'] text-xs tracking-[0.32em] uppercase text-white/45 mb-3"
        >

        </p>
        <h2
          ref={headingRef}
          className="font-['Anton'] text-[clamp(2.2rem,5vw,4.5rem)] uppercase tracking-[0.04em] text-white leading-[1.05]"
        >
          For centuries,<br></br> we observed biology.<br></br>Today, we can <br></br> engineer it.
        </h2>
      </div>

      {/* description — bottom right */}
      <div className="absolute bottom-[8%] right-[5%] max-w-[340px] hidden ">
        <p
          ref={descRef}
          className=" text-[clamp(0.85rem,1.1vw,1.05rem)] font-light leading-[1.5] text-white"
        >
          Explore the breakthroughs, technologies, and <br></br> builds shaping the future of life sciences.
        </p>
      </div>
    </>
  )
}