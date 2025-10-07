import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "William Smith | Full-Stack Developer & Designer",
  description: "Full-stack developer & designer building modern web apps with React, Next.js, TypeScript, and creative UI/UX design.",
  openGraph: {
    title: "William Smith | Full-Stack Developer & Designer",
    description: "Full-stack developer & designer building modern web apps with React, Next.js, TypeScript, and creative UI/UX design.",
    url: siteUrl,
    siteName: "William Smith Portfolio",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "William Smith - Full-Stack Developer & Designer Portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "William Smith | Full-Stack Developer & Designer",
    description: "Full-stack developer & designer building modern web apps with React, Next.js, TypeScript, and creative UI/UX design.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
