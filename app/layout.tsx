import type { Metadata } from "next";
import { Cinzel, Manrope } from "next/font/google";
import "./globals.css";

const headline = Cinzel({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Anime Pack Studio",
  description:
    "Fast AI pre-production for vertical 9:16 animated shorts with preserved voice-over and scene-by-scene anime prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${headline.variable} ${bodyFont.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
