"use client";

import { useState } from 'react';

const hotels = [
  {
    id: 'oberoi' as const,
    name: 'THE OBEROI',
    location: 'GURUGRAM',
    image: 'https://cdn.unionstack.link/uploads/24062026/v1/oberoiHotel.png',
  },
  {
    id: 'leela' as const,
    name: 'THE LEELA',
    location: 'GURUGRAM',
    image: 'https://cdn.unionstack.link/uploads/24062026/v1/leelaHotel.png',
  },
  {
    id: 'radisson' as const,
    name: 'RADISSON',
    location: 'GURUGRAM',
    image: 'https://cdn.unionstack.link/uploads/24062026/v1/radisson.png',
  },
];

type HotelId = 'oberoi' | 'leela' | 'radisson';

export default function Loop8() {
  const [activeHotel, setActiveHotel] = useState<HotelId>('leela');

  return (
    <section className="relative z-[100] pointer-events-auto flex flex-col items-center justify-center h-[100vh] w-full  gap-6 font-sans " style={{ paddingLeft: '180px', paddingRight: '40px' }}>

      {/* Title */}
      <h2 className=" text-[36px] font-semibold uppercase text-white text-center">
        BOOK YOUR STAY
      </h2>

      {/* Cards Row */}
      <div
  className="flex gap-3 w-full h-[360px]"
  onMouseLeave={() => setActiveHotel('leela')}
>
        {hotels.map((hotel) => {
          const isActive = activeHotel === hotel.id;

          return (
            <div
              key={hotel.id}
              onMouseEnter={() => setActiveHotel(hotel.id)}
              className={`relative overflow-hidden  cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] min-w-0 rounded-sm
                ${isActive ? 'flex-[2]' : 'flex-1'}`}
            >
              {/* Hotel Image */}
              <img
                src={hotel.image}
                alt={hotel.name}
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 object-cover
                  ${isActive ? 'scale-105' : 'scale-100'}`}
              />

              {/* Bottom dark bar */}
              <div className="absolute bottom-0 left-0 right-0 px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="w-6 h-px bg-white/40 mb-2"  style={{ background: 'linear-gradient(90deg, #D07D41 0%, rgba(221, 138, 66, 0) 100%)' }}  />
                  <h3 className=" uppercase  text-white text-[32px] font-semibold leading-[120%] tracking-[-1.5px] whitespace-nowrap transition-all duration-500"
                  >
                    {hotel.name}
                  </h3>
                  <p className="text-[14px] tracking-[2.52px] leading-[120%] uppercase text-white ">
                    {hotel.location}    
                  </p>
                </div>

            {isActive && (
  <div
    className="absolute bottom-0 left-0 right-0 backdrop-blur-sm px-5 py-6 flex items-center justify-between gap-3 "
    style={{ background: 'rgba(26, 13, 0, 0.85)' }}
  >
    <div className="min-w-0">
<div 
  className="w-6 h-px mb-2" 
  style={{ background: 'linear-gradient(90deg, #D07D41 0%, rgba(221, 138, 66, 0) 100%)' }} 
/>
      <h3 className="text-[32px] uppercase tracking-[-1.5px] leading-[120%] font-semibold text-white whitespace-nowrap">
        {hotel.name}
      </h3>
      <p className="text-[14px] tracking-[2.52px] leading-[120%] uppercase text-white ">
        {hotel.location}
      </p>
    </div>

    <button
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 bg-white text-black text-[12px] font-regular tracking-[1.2px] uppercase rounded-lg hover:bg-white/90 transition-colors px-8 py-4 leading-[16px]"

    >
      BOOK STAY
    </button>
  </div>
)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom label */}
      <p className="text-[16px] tracking-[0%] leading-[26px]   text-[#D4D4D4]">
        Special Offer for The Next Gene Delegates
      </p>

    </section>
  );
}