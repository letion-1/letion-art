import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PaintSplatter from "./components/PaintSplatter";
import CartProvider from "./components/CartProvider";
import PublicContactFooter from "./components/PublicContactFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Letion Ketienya",
  description: "Artist, painter and visual storyteller.",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "only light" }}
    >
      <body className="min-h-full bg-[#f3f0e9] text-[#111111]">
        <CartProvider>
          <div className="relative min-h-screen">
            <PaintSplatter />
            <div className="relative z-[20]">
              {children}
              <PublicContactFooter />
            </div>
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
