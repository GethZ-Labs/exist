/*
  Single place for every piece of EXiST copy and contact detail.
*/

const WHATSAPP = "94712353534";
const EMAIL = "existofficial7@gmail.com";

export const CONTACT = {
  email: EMAIL,
  whatsapp: WHATSAPP,
  whatsappDisplay: "+94 71 235 3534",
  location: "Sri Lanka",
  socials: [
    {
      label: "Facebook",
      handle: "EXiST Solutions",
      href: "https://www.facebook.com/profile.php?id=61594339844755",
    },
    {
      label: "Instagram",
      handle: "@exist.solutions",
      href: "https://www.instagram.com/exist.solutions/",
    },
    {
      // TODO: replace with the EXiST LinkedIn page once it is live.
      label: "LinkedIn",
      handle: "Coming soon",
      href: "https://www.linkedin.com/",
    },
    {
      label: "WhatsApp",
      handle: "+94 71 235 3534",
      href: `https://wa.me/${WHATSAPP}`,
    },
    {
      label: "Email",
      handle: EMAIL,
      href: `mailto:${EMAIL}`,
    },
  ],
};

export const whatsappLink = (message?: string) =>
  `https://wa.me/${WHATSAPP}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/* Web links open in a new tab; mailto links hand off to the mail app in place. */
export const linkTarget = (href: string) =>
  href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {};

/* Site pages, in navigation order (Socials is a menu, see Nav). */
export const NAV_PAGES = [
  { label: "Home", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Careers", href: "/careers" },
];

export const SERVICES = [
  {
    id: "websites",
    title: "Websites",
    symbol: "</>",
    summary:
      "Unique, modern and fast. Custom websites designed, built and launched in as little as 3–5 days.",
    tags: ["Business sites", "Landing pages", "E-commerce", "Web apps"],
  },
  {
    id: "design",
    title: "Design",
    symbol: "◐",
    summary:
      "Brand identities, logos, posters and campaign visuals that make small businesses look like industry giants.",
    tags: ["Brand identity", "Logos", "Posters", "Campaigns"],
  },
  {
    id: "social",
    title: "Social Media",
    symbol: "@",
    summary:
      "Content that stops the scroll. We plan, design and manage your channels so your brand shows up every day.",
    tags: ["Content", "Management", "Strategy", "Ads"],
  },
  {
    id: "seo",
    title: "SEO",
    symbol: "#",
    summary:
      "Get found by the people already searching for you — technical SEO, local search and content that ranks.",
    tags: ["Technical SEO", "Local search", "Content", "Analytics"],
  },
  {
    id: "systems",
    title: "Systems",
    symbol: "$",
    summary:
      "Custom business systems, dashboards and automations that remove busywork and let you scale.",
    tags: ["Custom software", "Automation", "Dashboards", "Integrations"],
  },
];

export const PROCESS = [
  {
    step: "01",
    title: "Plan",
    copy: "We learn your business, your customers and your goals — then map the shortest path to growth.",
  },
  {
    step: "02",
    title: "Create",
    copy: "Design, code and content crafted in-house. You see progress fast and shape every decision.",
  },
  {
    step: "03",
    title: "Grow",
    copy: "Launch is the beginning. We optimise, promote and evolve so your business keeps branching out.",
  },
];

export type ProjectMedia = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type Project = {
  id: string;
  index: string;
  title: string;
  kind: string;
  category: "Website" | "Design" | "Website + Design";
  year: string;
  summary: string;
  deliverables: string[];
  url?: string;
  urlLabel?: string;
  media: ProjectMedia[];
};

export const PROJECTS: Project[] = [
  {
    id: "union-home",
    index: "01",
    title: "Union Home",
    kind: "Real-estate website · demo",
    category: "Website",
    year: "2026",
    summary:
      "A property platform concept for a Sri Lankan land developer — a land finder that searches by location, land type and budget per perch, live project listings with amenities, and trust-building milestones up front.",
    deliverables: ["UI / UX design", "Responsive website", "Property search", "Project listings"],
    url: "https://unioncity.onrender.com",
    urlLabel: "unioncity.onrender.com",
    media: [
      { src: "/projects/unioncity-desktop.jpg", alt: "Union Home website — home page", width: 1440, height: 900 },
      { src: "/projects/unioncity-mobile.jpg", alt: "Union Home website on a phone", width: 780, height: 1688 },
      { src: "/projects/unioncity-tall.jpg", alt: "Union Home website — full page", width: 1440, height: 3600 },
    ],
  },
  {
    id: "lenz-line",
    index: "02",
    title: "Lenz & Line",
    kind: "Photography website",
    category: "Website",
    year: "2026",
    summary:
      "A portfolio and booking site for photographer Senul Embuldheniya — full-bleed imagery, collections by occasion and an enquiry form for portrait, event and editorial shoots.",
    deliverables: ["Art direction", "Portfolio website", "Collections", "Booking enquiries"],
    url: "https://lenz-and-line.netlify.app/",
    urlLabel: "lenz-and-line.netlify.app",
    media: [
      { src: "/projects/lenzline-desktop.jpg", alt: "Lenz & Line website — home page", width: 1440, height: 900 },
      { src: "/projects/lenzline-mobile.jpg", alt: "Lenz & Line website on a phone", width: 780, height: 1688 },
      { src: "/projects/lenzline-tall.jpg", alt: "Lenz & Line website — full page", width: 1440, height: 3287 },
    ],
  },
  {
    id: "science-classes",
    index: "03",
    title: "Quality Science",
    kind: "Group-class poster series",
    category: "Design",
    year: "2026",
    summary:
      "A bilingual poster series for Sehas Perera's island-wide online science classes for Grades 9–11 — bold, readable layouts made to perform on Facebook and WhatsApp.",
    deliverables: ["Poster design", "Social creatives", "Sinhala + English typography"],
    media: [
      { src: "/projects/science-quality.jpg", alt: "Quality Science poster for Grades 9–11", width: 1152, height: 1365 },
      { src: "/projects/science-grade10.jpg", alt: "Grade 10 Science one-day revision class poster", width: 1024, height: 1024 },
    ],
  },
  {
    id: "exist-26",
    index: "04",
    title: "EXiST 26",
    kind: "Batch party website + poster series",
    category: "Website + Design",
    year: "2026",
    summary:
      "Identity, website and campaign for the EXiST 26 A/L batch party — a live countdown, registration and login, downloadable rules, Mr & Miss EXiST, and a teaser-to-sold-out poster run that the campaign itself reported at 220+ registrations.",
    deliverables: ["Event identity", "Website + registration", "Countdown", "Social campaign"],
    url: "https://exist-26.vercel.app/",
    urlLabel: "exist-26.vercel.app",
    media: [
      { src: "/projects/exist26-desktop.jpg", alt: "EXiST 26 website — countdown page", width: 1440, height: 900 },
      { src: "/projects/exist26-coming-soon.webp", alt: "EXiST 26 batch party — coming soon poster", width: 2000, height: 2000 },
      { src: "/projects/exist26-mr-miss.webp", alt: "Mr & Miss EXiST registrations poster", width: 1024, height: 1536 },
      { src: "/projects/exist26-tickets.webp", alt: "EXiST 26 tickets 79% sold out poster", width: 2000, height: 2000 },
      { src: "/projects/exist26-mobile.jpg", alt: "EXiST 26 website on a phone", width: 780, height: 1688 },
    ],
  },
  {
    id: "exist-brand",
    index: "05",
    title: "EXiST Better",
    kind: "In-house brand campaign",
    category: "Design",
    year: "2026",
    summary:
      "Our own launch campaign — a social poster series introducing EXiST and what we do, from dream websites to growth for small businesses.",
    deliverables: ["Campaign concept", "Poster series", "Social media"],
    media: [
      { src: "/work/what-we-do.webp", alt: "What we do poster", width: 1600, height: 1600 },
      { src: "/work/dream-website.webp", alt: "We build your dream website poster", width: 1600, height: 1600 },
      { src: "/work/small-business.webp", alt: "We make small business look like industry giants poster", width: 1254, height: 1254 },
      { src: "/work/build-first.webp", alt: "Let's build first poster", width: 1600, height: 1600 },
      { src: "/work/business-goals.webp", alt: "What are your business goals poster", width: 1600, height: 1600 },
      { src: "/work/exist-better.webp", alt: "EXiST better poster", width: 1600, height: 1600 },
    ],
  },
];

export const ROLES = [
  {
    title: "Editor",
    type: "Video & content",
    copy: "Cut reels, ads and brand films that stop the scroll — pacing, sound and story.",
    skills: ["Premiere / CapCut", "Motion basics", "Storytelling"],
  },
  {
    title: "Mobile App Developer",
    type: "Engineering",
    copy: "Build fast, beautiful apps for iOS and Android that our clients' customers love using.",
    skills: ["React Native / Flutter", "APIs", "App stores"],
  },
  {
    title: "SEO Specialist",
    type: "Growth",
    copy: "Help Sri Lankan businesses get found — technical audits, local search and content that ranks.",
    skills: ["Technical SEO", "Google Business", "Analytics"],
  },
];

export const PROMISES = [
  {
    title: "Unique",
    copy: "No templates. Every brand, page and post is designed for you from a blank canvas.",
  },
  {
    title: "Modern",
    copy: "Built on the same technology the world's leading companies use — fast, secure, future-proof.",
  },
  {
    title: "Fast",
    copy: "Websites live in 3–5 days. Quick replies, clear timelines and no endless waiting.",
  },
];
