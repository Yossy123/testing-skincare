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
  title: "NOBYDERM | Clinical Skincare & Dermatology Clinic",
  description: "Official NOBYDERM store and clinic portal. Scientifically formulated skincare and aesthetic treatments.",
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
    >
      <body className="min-h-full flex flex-col bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-rose-100 selection:text-rose-900">
        {children}
      </body>
    </html>
  );
}
