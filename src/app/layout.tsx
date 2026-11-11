import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GymBro Analytics — Données & Progression",
  description: "Plateforme d'analyse et de surcharge progressive pour la musculation",
  applicationName: "GymBro",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GymBro",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#090B0E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className="bg-[#090B0E] text-zinc-100 min-h-screen selection:bg-zinc-800 selection:text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
