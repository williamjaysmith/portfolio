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

export const metadata: Metadata = {
  title: "William Smith | Full-Stack Developer & Designer",
  description: "Full-stack developer and designer specializing in React, Next.js, TypeScript, and UI/UX design. Building modern web applications and creative digital experiences.",
  openGraph: {
    title: "William Smith | Full-Stack Developer & Designer",
    description: "Full-stack developer and designer specializing in React, Next.js, TypeScript, and UI/UX design.",
    type: "website",
    url: "https://williamjaysmith.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "William Smith Portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "William Smith | Full-Stack Developer & Designer",
    description: "Full-stack developer and designer specializing in React, Next.js, TypeScript, and UI/UX design.",
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
