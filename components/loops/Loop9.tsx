"use client";

export default function Loop7() {
  return (
    <section className="relative flex items-center justify-center py-12 pb-30 font-sans min-w-300 pl-20">
      <div className="contentContainer flex items-center gap-10 justify-between w-[1200px]">
        
        {/* Background Image / HQ Image */}
        <div className="hqImage flex-shrink-0">
          <img 
            src="https://cdn.unionstack.link/uploads/22062026/v1/dlfHQ.png" 
            alt="DLF Cyberpark" 
            className="w-full h-[368px] object-cover rounded-xl" 
          />
        </div>

        {/* Join Us Content */}
        <div className="joinUsContent w-[600px] h-[368px] bg-white/10 backdrop-blur-sm rounded-xl p-10 flex flex-col justify-center flex-shrink-0">
          
          <div className="heading text-[36px] leading-[1.1] uppercase">
            Join us at <br />
            <span className="font-semibold">the next gene</span>
          </div>

          {/* Timeline */}
          <div className="timeline flex gap-4 mt-6">
            <div className="dayAndIcon flex items-center gap-2">
              <div className="icon w-6 h-6"><img src="https://cdn.unionstack.link/uploads/22062026/v1/calender.svg" alt="calender" /></div>
              <div className="day text-[16px]">Sat, 19 Sept 2026</div>
            </div>

            <div className="timeAndIcon flex items-center gap-2">
              <div className="icon w-6 h-6"><img src="https://cdn.unionstack.link/uploads/22062026/v1/clock.svg" alt="clock" /></div>
              <div className="time text-[16px]">08:30 AM Onwards</div>
            </div>
          </div>

          {/* Avenue / Location */}
          <div className="avenue flex items-start gap-2 mb-6 mt-4">
            <div className="icon w-6 h-6 mt-0.5"><img src="https://cdn.unionstack.link/uploads/22062026/v1/avenue.svg" alt="avenue" /></div>
            <div className="placeAndCity">
              <div className="place text-[20px] font-medium">DLF Cyberpark</div>
              <div className="city text-[16px] text-[#D4D4D4]">Gurugram, India</div>
            </div>
          </div>

          {/* Buttons */}
          <div className="classicButtons flex gap-4">
            <button className="addToYourCalendar px-8 py-4 bg-white text-black font-regular rounded-lg hover:bg-white/90 transition tracking-[1.2px] uppercase text-[12px] leading-4">
              Add to Your Calendar
            </button>
            <button className="viewOnMap px-8 py-4 text-white font-regular rounded-lg hover:bg-white/90 transition tracking-[1.2px] uppercase text-[12px] leading-4 border border-white/40">
              View on Map
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}