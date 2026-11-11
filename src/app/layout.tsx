import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GymBro Analytics — Données & Progression",
  description: "Plateforme d'analyse et de surcharge progressive pour la musculation",
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
