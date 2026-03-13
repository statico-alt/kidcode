import type { Metadata } from "next";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KidCode",
  description: "Build cool stuff with AI!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`font-sans ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
