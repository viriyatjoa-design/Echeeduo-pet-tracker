import type { Metadata, Viewport } from "next";
import "./globals.css";
import { strings } from "@/lib/strings";

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
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1712" },
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
const themeScript = `(function(){try{var apply=function(dark){document.documentElement.classList.toggle('dark',dark);var c=dark?'#1c1712':'#f7f3ec';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c)})};window.__setTheme=apply;var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;apply(t==='dark'||(!t&&m))}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
