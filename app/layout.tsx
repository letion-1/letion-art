import type {
  Metadata,
} from "next";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";

import PaintSplatter from "./components/PaintSplatter";

import CartProvider from "./components/CartProvider";

const geistSans =
  Geist({
    variable:
      "--font-geist-sans",

    subsets: [
      "latin",
    ],
  });

const geistMono =
  Geist_Mono({
    variable:
      "--font-geist-mono",

    subsets: [
      "latin",
    ],
  });

export const metadata:
  Metadata = {
    title:
      "Letion Ketienya",

    description:
      "Artist, painter and visual storyteller.",
  };

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f3f0e9]">
        <CartProvider>
          <div className="relative min-h-screen">
            <PaintSplatter />

            <div className="relative z-[20]">
              {children}
            </div>
          </div>
        </CartProvider>
      </body>
    </html>
  );
}