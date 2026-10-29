import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";

// Closest free match to the Avenir face used on bookleafpub.com.
const nunito = Nunito_Sans({ subsets: ["latin"], weight: ["300", "400", "600", "700"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BookLeaf Author Support",
  description: "Author support and communication portal for BookLeaf Publishing",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} font-sans`}>{children}</body>
    </html>
  );
}
