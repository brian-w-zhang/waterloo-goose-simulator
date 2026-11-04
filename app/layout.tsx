import type { Metadata } from "next";
import { Nunito, Patrick_Hand } from "next/font/google";
import palette from "../config/palette.json";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waterloo Goose Simulator",
  description: "A Canada goose menace loose on a University of Waterloo campus built from open map data.",
};

// one rounded sans for the HUD, one handwriting face for the notebook (to-do list, area names)
const ui = Nunito({ subsets: ["latin"], weight: ["500", "700", "800", "900"], variable: "--font-ui", display: "swap" });
const hand = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-hand", display: "swap" });

// every UI colour reaches CSS as a custom property from the palette "ui" group (--ui-<name>)
const uiVars = Object.fromEntries(Object.entries(palette.ui).map(([k, v]) => [`--ui-${k}`, v])) as React.CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${hand.variable}`} style={uiVars}>
      <body>{children}</body>
    </html>
  );
}
