'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

const FRONTIERS = [
  { label: 'Gene Editing & CRISPR',   position: 'bottom-[37.5%] right-[23%]'    },
  { label: 'Longevity & Aging',        position: 'bottom-[25%] right-[23%]'   },
  { label: 'Computational Biology',    position: 'bottom-[12.5%] right-[12.5%]'    },
  { label: 'Drug & Gene Discovery',    position: 'bottom-[50%] right-[12.5%]'   },
  { label: 'Biomanufacturing',         position: 'bottom-[37.5%] right-[3%]'    },
  { label: 'Space & Agri-biology',     position: 'bottom-[25%] right-[3%]'   },
]

export default function Loop3() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>(Array(FRONTIERS.length).fill(null))

  useEffect(() => {
    if (!headingRef.current) return

    const headingSplit = new SplitText(headingRef.current, { type: 'chars' })

    gsap.fromTo(headingSplit.chars,
      { opacity: 0, filter: 'blur(20px)', y: -24 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 1, ease: 'power3.out',
        stagger: { each: 0.035 } }
    )

    gsap.fromTo(cardsRef.current,
      { opacity: 0, filter: 'blur(12px)', y: 20 },
      { opacity: 1, filter: 'blur(0px)',  y: 0,
        duration: 0.7, ease: 'power3.out',
        stagger: { each: 0.1 }, delay: 0.3 }
    )

    return () => { headingSplit.revert() }
  }, [])

  return (
    <div className="absolute inset-0">

      {/* Heading */}
      <h2
        ref={headingRef}
        className="absolute top-[17%] left-[15%] text-left   text-[36px] font-semibold  text-white leading-[100%] "
      >
        Dive Deep Into The Six<br /> Frontiers Redefining<br /> Bioscience
      </h2>

      {/* Floating cards */}
      {FRONTIERS.map((f, i) => (
       <div
  key={f.label}
  ref={el => { cardsRef.current[i] = el }}
  style={{ padding: '24px 0px' }}
  className={`absolute ${f.position} backdrop-blur-sm bg-white/10 border border-white/10 rounded-[12px]  min-w-[280px] `}
>
          <span className=" text-[20px] font-light text-white   flex justify-center items-center leading-[27px]">
            {f.label}
          </span>
        </div>
      ))}

    </div>
  )
}