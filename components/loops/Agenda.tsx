'use client'



const AGENDA_ITEMS = [
  // Row 1
  {
    title: 'Fireside Chats',
    description: null,
    tag: 'REVEALING SOON',
    row: 1,
    flex: '0 0 calc(33% - 8px)',
  },
  {
    title: 'Panel Discussions',
    description: null,
    tag: 'REVEALING SOON',
    row: 1,
    flex: '0 0 calc(33% - 8px)',
  },
  {
    title: 'Paper Presentations',
    description: 'Discover cutting-edge scientific findings and data shared by researchers fresh from the lab.',
    tag: null,
    row: 1,
    flex: '1 1 0',
  },

  // Row 2
  {
    title: 'Biotech Startup Pitches',
    description: 'Witness emerging biotech founders showcase their innovations to secure funding from judges and investors.',
    tag: null,
    row: 2,
    flex: '1 1 0',
  },
  {
    title: 'Hands-On Lab Experiments',
    description: 'Roll up your sleeves and directly test new-age lab equipment, protocols, and biotech software.',
    tag: null,
    row: 2,
    flex: '1 1 0',
  },

  // Row 3
  {
    title: 'Awards',
    description: 'Celebrate individuals & organizations pushing the boundaries of BioScience.',
    tag: null,
    row: 3,
    flex: '1 1 0',
  },
  {
    title: 'Exhibitions',
    description: 'Explore a bustling floor where companies display their latest tools, platforms & more.',
    tag: null,
    row: 3,
    flex: '1 1 0',
  },
  {
    title: 'Experience Zones',
    description: 'Step inside spaces built to let you see, touch, and play with complex biology.',
    tag: null,
    row: 3,
    flex: '1 1 0',
  },
]

const rows = [1, 2, 3]

export default function AgendaContent() {
  return (
    <div className="w-full pt-20 pb-16 pl-[200px] pr-[80px] box-border font-sans   h-full flex  flex-col justify-center ">

      {/* Section heading */}
      <h2 className="text-[40px] font-semibold text-white text-center uppercase  leading-none mb-10">
        Agenda
      </h2>

      {/* Rows */}
      <div className="flex flex-col gap-5">
        {rows.map(row => (
          <div key={row} className="flex flex-row gap-5 w-full">
            {AGENDA_ITEMS.filter(item => item.row === row).map((item, i) => (
      <div
  key={i}
  style={{ flex: item.flex }}
  className="flex flex-col items-start justify-center gap-2 rounded-lg px-6 min-h-[140px] 
             bg-white/5 
              backdrop-blur-lg
             border border-white/20 
             shadow-2xl
             isolate
             hover:bg-white/20 hover:border-white/50
             transition-all duration-300" 
>
                {/* Card title */}
                <span className="text-[24px] font-semibold text-white leading-[120%] tracking-normal">
                  {item.title}
                </span>

                {/* Tag or description */}
                {item.tag ? (
                  <span className=" text-[14px] font-semibold uppercase  leading-6 text-white  px-3 py-1 w-fit bg-white/10">
                    {item.tag}
                  </span>
                ) : (
                  <p className="text-[14px] font-normal text-[#E5E5E5] leading-none tracking-normal m-0">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

    </div>
  )
}