import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { TransitionProvider } from "@/components/site/Transition";
import "./globals.css";
import "./site.css";

const jaro = localFont({
  src: "./fonts/Jaro.ttf",
  variable: "--font-display",
  display: "swap",
});

const grotesk = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

/* Public address for share previews: set NEXT_PUBLIC_SITE_URL, or Render provides RENDER_EXTERNAL_URL. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "EXiST — Digital solutions to help your business exist better",
  description:
    "EXiST is a Sri Lankan digital studio building websites, brand design, social media, SEO and business systems that make small businesses look like industry giants — premium work at prices that fit.",
  icons: { icon: "/brand/icon.jpg" },
  openGraph: {
    title: "EXiST — Exist better.",
    description:
      "Websites, design, social media, SEO and systems. We turn fading brands into next-gen icons.",
    images: ["/brand/logo-lime.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#050604",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jaro.variable} ${grotesk.variable} ${mono.variable}`}
    >
      <body>
        <TransitionProvider>{children}</TransitionProvider>
      </body>
    </html>
  );
}
