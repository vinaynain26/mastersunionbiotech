import Image from 'next/image';
import Link from 'next/link';

// ── Data ────────────────────────────────────────────────────────────────────

const navLinks = [
  { label: 'Origin', href: '#' },
  { label: 'Discover', href: '#' },
  { label: 'Highlights', href: '#' },
  { label: 'Agenda', href: '#' },
  { label: 'Awards', href: '#' },
  { label: 'Speakers', href: '#' },
  { label: 'Passes', href: '#' },
];

const actionLinks = [
  { label: 'Register to Attend', href: '#' },
  { label: 'Speak at TNG', href: '#' },
  { label: 'Exhibit with Us', href: '#' },
  { label: 'Sponsorship', href: '#' },
  { label: 'Press & Media', href: '#' },
];

const contacts = [
  {
    category: 'Summit Partnership',
    name: 'Sudhanshu Garg',
    phone: '83760 67379',
    email: 'sudhanshu.garg@mastersunion.org',
  },
  {
    category: 'Sponsorship',
    name: 'Vishal Parashar',
    phone: '721 781 8206',
    email: 'vishal.parashar@mastersunion.org',
  },
  {
    category: 'Awards',
    name: 'Akshat Ghai',
    phone: '7428 183 813',
    email: 'akshat.ghai@mastersunion.org',
  },
  {
    category: 'Exhibition',
    name: 'Sayan Chakraborty',
    phone: '95648 61966',
    email: 'sayan.chakraborty@mastersunion.org',
  },
  {
    category: 'Delegate',
    name: 'Vidisha Dev',
    phone: '89792 57252',
    email: 'vidisha.dev@mastersunion.org',
  },
  {
    category: 'Media and Press',
    name: 'Sasha Bakshi',
    phone: '786 965 6729',
    email: 'sasha.bakshi@mastersunion.org',
  },
];

const socialLinks = [
  { src: 'https://cdn.unionstack.link/uploads/25062026/v1/instagram.svg', href: '#', label: 'Instagram' },
  { src: 'https://cdn.unionstack.link/uploads/25062026/v1/linkedin.svg',  href: '#', label: 'LinkedIn'  },
  { src: 'https://cdn.unionstack.link/uploads/25062026/v1/facebook.svg',  href: '#', label: 'Facebook'  },
  { src: 'https://cdn.unionstack.link/uploads/25062026/v1/twitter.svg',   href: '#', label: 'Twitter'   },
  { src: 'https://cdn.unionstack.link/uploads/25062026/v1/youtube.svg',   href: '#', label: 'YouTube'   },
];

const legalLinks = [
  { label: 'Privacy Policy',     href: '#' },
  { label: 'Terms & Conditions', href: '#' },
  { label: 'Cookie Policy',      href: '#' },
];

// ── Footer Component ────────────────────────────────────────────────────────

export default function Footer() {
  return (
    <footer className="bg-black/10 backdrop-blur-xs text-white font-sans  ">

      {/* ── Top Block ── */}
      <div className=" mx-auto px-10">

        {/* Logo Row */}
        <div className="flex items-center  mb-14">
          <Image
            src="https://cdn.unionstack.link/uploads/18062026/v1/muLogo.svg"
            alt="Masters' Union"
            width={120}
            height={36}
            className="object-contain"
          />
          <div className="w-px h-8 bg-white/30 mx-2" />
          <span className="text-[17.5px] font-semibold ">
            School of Bioscience
          </span>
        </div>

        {/* Three-Column Grid */}
        <div className="grid grid-cols-3 gap-40 pb-8 ">

          {/* Column 1 – Event Details */}
          <div className="flex flex-col gap-2 text-[14px] text-[#D4D4D4] leading-[160%] font-regular">
            <div className="flex items-start gap-2">
              <Image src="https://cdn.unionstack.link/uploads/25062026/v1/mail.svg" alt="" width={16} height={16} className="shrink-0 mt-0.5" />
              <span>19 September 2026</span>
            </div>
            <div className="flex items-start gap-2">
              <Image src="https://cdn.unionstack.link/uploads/25062026/v1/location.svg" alt="" width={16} height={16} className="shrink-0 mt-0.5" />
              <span>
                DLF Cyberpark, Phase II, Udyog Vihar,<br />
                Sector 20, Gurugram, Haryana, 122008
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Image src="https://cdn.unionstack.link/uploads/25062026/v1/mail.svg" alt="" width={16} height={16} className="shrink-0 mt-0.5" />
              <a
                href="mailto:Info@mastersunion.org"
                className="hover:text-white transition-colors duration-200"
              >
                Info@mastersunion.org
              </a>
            </div>
          </div>

          {/* Column 2 – Nav Links */}
          <div className="flex flex-col gap-[12px]">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] text-[#f5f5f5] hover:text-white transition-colors duration-200 w-fit"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Column 3 – Action Links */}
          <div className="flex flex-col gap-[12px]">
            {actionLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] text-[#f5f5f5] hover:text-white transition-colors duration-200 w-fit leading-[120%]"
              >
                {link.label}
              </Link>
            ))}
          </div>

        </div>
      </div>

      {/* Grey divider */}
      <div className=" mx-auto px-10">
        <hr className="border-t border-white/15" />
      </div>

      {/* ── Contacts Grid ── */}
      <div className=" mx-auto px-10 py-8">
        <div className="grid grid-cols-3 gap-x-40 gap-y-5">
          {contacts.map((contact) => (
            <div key={contact.category}>
              <p className="text-[16.6px] font-semibold text-white  leading-[120%] mb-2">
                {contact.category}
              </p>
              <p className="text-[12px] text-[#d4d4d4] font-semibold ">
                {contact.name}
              </p>
              <p className="text-[12px] text-[#d4d4d4]  ">
                {contact.phone}
              </p>
              <p className="text-[12px] text-[#d4d4d4]  ">
                 {contact.email}
              </p>
     
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="border-t border-white/15 mx-10 ">
        <div className=" mx-auto px-10 py-5 flex items-center justify-between ">

          {/* Copyright */}
          <p className="text-[14px] text-[#D4D4D4]">
            Copyright @ 2026 Masters&apos; Union
          </p>

          {/* Legal Links */}
          <div className="flex items-center gap-5">
            {legalLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] text-[#D4D4D4] underline underline-offset-2 decoration-white/30 hover:text-white hover:decoration-white transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-5">
            {socialLinks.map(({ src, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className=" hover:opacity-100 transition-opacity duration-200"
              >
                <Image src={src} alt={label} width={20} height={20} />
              </a>
            ))}
          </div>

        </div>
      </div>

    </footer>
  );
}