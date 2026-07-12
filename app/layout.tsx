import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { strings } from "@/lib/strings";

// Nunito variable (latin), self-hosted so builds never depend on a font CDN.
// The rounded warmth is half the "soft wellness" personality (see CONTEXT.md).
const nunito = localFont({
  src: "./fonts/nunito-latin-var.woff2",
  weight: "200 1000",
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: strings.appName,
  description: `${strings.appName} — ${strings.tagline}`,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: strings.appName, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efece4" },
    { media: "(prefers-color-scheme: dark)", color: "#141922" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Required for env(safe-area-inset-*) to be non-zero on iOS — the nav,
  // FAB, and toaster all pad with it.
  viewportFit: "cover",
};

// Set theme class before paint to avoid a flash, and keep the browser-chrome
// theme-color in sync with the CHOSEN theme (not just the OS preference) —
// the theme toggle calls the same window hook on toggle.
const themeScript = `(function(){try{var apply=function(dark){document.documentElement.classList.toggle('dark',dark);var c=dark?'#141922':'#efece4';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c)})};window.__setTheme=apply;var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;apply(t==='dark'||(!t&&m))}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={nunito.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
