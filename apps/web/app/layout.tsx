import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Cinzel, Figtree, Hanken_Grotesk, JetBrains_Mono, Newsreader, Noto_Serif_Devanagari, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-cinzel", display: "swap", preload: false });

const sans = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "optional", preload: false });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "optional", preload: false });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "optional", preload: false });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bricolage",
  display: "optional",
  preload: false,
});
const devanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600"],
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
});

const SITE = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Kasauti — Crash tests for voice agents",
    template: "%s · Kasauti",
  },
  description:
    "Synthetic Indian callers phone your voice agent on a real +91 line and hand back a red, amber, green report card that quotes the exact line that broke. Change one line, rerun, see what got fixed.",
  keywords: ["voice agent testing", "Bolna", "Hinglish", "regression testing", "AI voice agents", "India", "+91"],
  openGraph: {
    type: "website",
    siteName: "Kasauti",
    title: "Kasauti — Crash tests for voice agents",
    description:
      "Real Indian callers ring your bot on a +91 line and quote the exact line that broke. Fix one line, rerun, see what got fixed.",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kasauti — Crash tests for voice agents",
    description: "Real Indian callers ring your bot on a +91 line and quote the exact line that broke.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${hanken.variable} ${mono.variable} ${serif.variable} ${bricolage.variable} ${devanagari.variable} ${jakarta.variable} ${cinzel.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
