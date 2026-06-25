"use client";

const TICKET_PATH =
  "M413.499 281.992L426.818 295.314C427.574 296.071 427.996 297.099 427.989 298.168L427.526 369.602C427.512 371.801 425.709 373.539 423.548 373.942C415.332 375.475 408.536 381.68 406.826 389.734C406.367 391.895 404.62 393.706 402.41 393.706H24.4195C22.2104 393.706 20.4604 391.898 20.0326 389.73C18.4363 381.643 12.0636 375.27 3.97579 373.674C1.80846 373.246 0 371.496 0 369.287V298.153C0 297.092 0.421313 296.075 1.17128 295.325L14.5012 281.992C16.063 280.43 16.0629 277.898 14.5009 276.336L1.17158 263.006C0.42143 262.256 0 261.239 0 260.178V24.4232C0 22.214 1.80847 20.4641 3.97577 20.0362C12.0637 18.4392 18.4364 12.0643 20.0327 3.97579C20.4604 1.80846 22.2104 0 24.4195 0H403.58C405.79 0 407.54 1.80845 407.967 3.97582C409.563 12.0664 415.936 18.4399 424.024 20.0363C426.192 20.4641 428 22.214 428 24.4232V260.178C428 261.239 427.579 262.256 426.828 263.006L413.499 276.336C411.937 277.898 411.937 280.43 413.499 281.992Z";

const TICKET_STROKE_PATH =
  "M24.4199 0.5H403.58C405.494 0.5 407.083 2.07961 407.477 4.07227C409.112 12.3617 415.641 18.8907 423.928 20.5264C425.92 20.9198 427.5 22.5089 427.5 24.4229V260.178C427.5 261.106 427.131 261.997 426.475 262.653L413.146 275.982C411.388 277.74 411.389 280.588 413.146 282.346L426.465 295.668C427.126 296.33 427.495 297.229 427.489 298.165L427.025 369.599C427.013 371.505 425.439 373.08 423.456 373.45C415.059 375.017 408.093 381.363 406.337 389.631C405.913 391.624 404.323 393.206 402.41 393.206H24.4199C22.5058 393.206 20.9168 391.627 20.5234 389.634C18.8879 381.347 12.359 374.818 4.07227 373.183C2.07978 372.789 0.500201 371.201 0.5 369.287V298.153C0.5 297.225 0.868391 296.335 1.52441 295.679L14.8545 282.346C16.6115 280.588 16.6116 277.74 14.8545 275.982L1.52539 262.653C0.869008 261.997 0.5 261.106 0.5 260.178V24.4229C0.500184 22.5089 2.0797 20.9199 4.07227 20.5264C12.3592 18.8902 18.8879 12.3596 20.5234 4.07227C20.9168 2.07963 22.5058 0.5 24.4199 0.5Z";

const TICKET_TOP_EDGE =
  "M24.4199 0.5H403.58C405.494 0.5 407.083 2.07961 407.477 4.07227C409.112 12.3617 415.641 18.8907 423.928 20.5264C425.92 20.9198 427.5 22.5089 427.5 24.4229V40C400 30 28 30 0.5 40V24.4229C0.500184 22.5089 2.0797 20.9199 4.07227 20.5264C12.3592 18.8902 18.8879 12.3596 20.5234 4.07227C20.9168 2.07963 22.5058 0.5 24.4199 0.5Z";

type Pass = {
  tier: string;
  originalPrice: string;
  price: string;
};

const PASSES: Pass[] = [
  { tier: "Student",  originalPrice: "₹4,999",  price: "₹1,999" },
  { tier: "Delegate", originalPrice: "₹9,999",  price: "₹4,999" },
  { tier: "VIP",      originalPrice: "₹19,999", price: "₹9,999" },
];

const CLIP_ID_PREFIX = "ticket-clip-";

function TicketCard({ pass, index, featured }: { pass: Pass; index: number; featured?: boolean }) {
  const clipId = `${CLIP_ID_PREFIX}${index}`;
  const glowId = `ticket-glow-${index}`;
  const topId  = `ticket-top-${index}`;
  const leftId = `ticket-left-${index}`;

  const w = featured ? 428 : 322;
  const h = featured ? 394 : 296;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: w, height: h, opacity: featured ? 1 : 0.85 }}
    >
      {/* ── SVG shell ── */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={w}
        height={h}
        viewBox="0 0 428 394"
        fill="none"
        className="absolute inset-0 pointer-events-none"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={TICKET_PATH} />
          </clipPath>
        </defs>

        {/* Backdrop blur */}
        <foreignObject x="-40" y="-40" width="508" height="473.706">
          <div
            style={{
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(20px)",
              clipPath: `url(#${clipId})`,
              height: "100%",
              width: "100%",
            }}
          />
        </foreignObject>

        {/* Base glass fill */}
        <path d={TICKET_PATH} fill="white" fillOpacity={featured ? "0.08" : "0.05"} />

        {/* Warm radial glow */}
        <path d={TICKET_PATH} fill={`url(#${glowId})`} />

        {/* Top rim light */}
        <path d={TICKET_TOP_EDGE} fill={`url(#${topId})`} />

        {/* Left rim light */}
        <path d={TICKET_PATH} fill={`url(#${leftId})`} fillOpacity="0.6" />

        {/* Outer border */}
        <path
          d={TICKET_STROKE_PATH}
          stroke={featured ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)"}
          strokeWidth="1"
        />

        {/* Inset thickness line */}
        <path d={TICKET_STROKE_PATH} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      </svg>

      {/* ── Content ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-9 pb-9"
        style={{ paddingTop: featured ? 40 : 30 }}
      >
        {/* Tier */}
        <p
          className="font-semibold text-[#D4D4D4]  leading-[120%]"
          style={{ fontSize: featured ? 32 : 24 }}
        >
          {pass.tier}
        </p>

        {/* Original price struck through */}
        <p
          className="font-normal text-white/25 my-2  line-through decoration-white/25 tracking-tight"
          style={{ fontSize: featured ? 32 : 20 }}
        >
          {pass.originalPrice}
        </p>

        {/* Hero price */}
        <p
          className="font-bold text-white  leading-[120%] tracking-tight"
          style={{ fontSize: featured ? 62 : 48 }}
        >
          {pass.price}
        </p>

         {/* ── Separator + sub-label for Corporate (index 2) only ── */}
  {index === 2 && (
    <div className="w-full mt-0.5">
     
      <p className="text-white text-center m-0  uppercase leading-[120%]"
         style={{ fontSize: 12, letterSpacing: "1.2px" }}>
        Minimum 5 Delegates
      </p>
    </div>
  )}

        <div className="flex-1" />

        {/* CTA */}
        <button
          className="w-full bg-white text-black rounded-xl font-semibold tracking-wide transition-colors duration-200 hover:bg-white/90 cursor-pointer border-none"
          style={{
            padding: featured ? "18px" : "14px",
            fontSize: featured ? 16 : 14,
            borderRadius: featured ? 12 : 10,
          }}
        >
          Get Pass
        </button>
      </div>
    </div>
  );
}

export default function Passes() {
  return (
    <section className="min-h-screen w-full max-w-[1200px] mx-auto flex flex-col items-center justify-center py-20 px-6 gap-8 bg-transparent text-white font-sans ml-50 ">

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-[40px] uppercase font-semibold m-0 text-white">
          Choose Your Pass
        </h2>
      </div>

      {/* Cards row */}
      <div className="flex items-center gap-12 justify-center ">
        {PASSES.map((pass, i) => (
          <TicketCard key={pass.tier} pass={pass} index={i} featured={i === 1} />
        ))}
      </div>

    </section>
  );
}