'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

export default function HighContent() {
  const line1Ref   = useRef<HTMLSpanElement>(null)
  const line2Ref   = useRef<HTMLSpanElement>(null)
  const line3Ref   = useRef<HTMLSpanElement>(null)
  const line4Ref   = useRef<HTMLSpanElement>(null)
  const descRef    = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const els = [line1Ref, line2Ref, line3Ref, line4Ref, descRef]
    if (els.some(r => !r.current)) return

    // Split each line separately for staggered blur-in
    const split1 = new SplitText(line1Ref.current!, { type: 'chars' })
    const split2 = new SplitText(line2Ref.current!, { type: 'chars' })
    const split3 = new SplitText(line3Ref.current!, { type: 'chars' })
    const split4 = new SplitText(line4Ref.current!, { type: 'chars' })
    const splitD = new SplitText(descRef.current!,  { type: 'words' })

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    // Line 1 — "For centuries, we"
    tl.fromTo(split1.chars,
      { opacity: 0, filter: 'blur(14px)', y: -18 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.9, stagger: { each: 0.028 } },
      0
    )
    // Line 2 — "observed Biology."
    tl.fromTo(split2.chars,
      { opacity: 0, filter: 'blur(14px)', y: -18 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.9, stagger: { each: 0.028 } },
      0.12
    )
    // Line 3 — "Today, we can"
    tl.fromTo(split3.chars,
      { opacity: 0, filter: 'blur(20px)', y: -28 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 1.1, stagger: { each: 0.04 } },
      0.32
    )
    // Line 4 — "Engineer it."
    tl.fromTo(split4.chars,
      { opacity: 0, filter: 'blur(20px)', y: -28 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 1.1, stagger: { each: 0.04 } },
      0.44
    )
    // Description — word-level stagger, softer
    tl.fromTo(splitD.words,
      { opacity: 0, filter: 'blur(10px)', y: 14 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.7, stagger: { each: 0.04 } },
      0.7
    )

    return () => {
      split1.revert()
      split2.revert()
      split3.revert()
      split4.revert()
      splitD.revert()
    }
  }, [])

  return (
    <>
      {/* ── Main headline — upper-left ── */}
      <div className="absolute top-[25%] left-[13%] max-w-[46vw] font-sans">
        <h1 className="font-semibold text-white leading-[1.05]">

          {/* First sentence — slightly smaller weight */}
          <div className="text-[32px] font-semibold leading-1.1 tracking-[0%] mb-4">
            <span ref={line1Ref} className="block">For centuries, we</span>
            <span ref={line2Ref} className="block">observed Biology.</span>
          </div>

          {/* Second sentence — visually larger, extra bold */}
          <div className="text-[32px] font-semibold leading-[100%] tracking-[0%] mt-8">
            <span ref={line3Ref} className="block">Today, we can</span>
            <span ref={line4Ref} className="block">Engineer it.</span>
          </div>

        </h1>
      </div>

      {/* ── Description — lower-right ── */}
      <div className="absolute bottom-[10%] right-[2%] max-w-[480px]">
        <p
          ref={descRef}
          className="text-[24px]  font-semibold leading-[120%] text-white"
        >
          Meet Nobel Laureates, founders, policymakers, clinicians, researchers, and
          academicians uncovering the mysteries.
        </p>
      </div>
    </>
  )
}