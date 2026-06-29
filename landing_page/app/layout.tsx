import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SkipLink } from "@/lib/legal/chrome";
import { CookieConsentBanner } from "@/lib/legal/cookie-consent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spine — Validated AI",
  description:
    "Build validated AI pipelines. Structured output, implicit schema validation, A/B tested strategies, caching and cost attribution — without the engineering grind.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        <SkipLink />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
