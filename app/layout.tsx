import type { Metadata } from "next";
import { AppThemeProvider } from "./components/AppThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "lyricstapper",
  description: "Manually time lyrics to music and export styled subtitles or MP4 — entirely in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><AppThemeProvider>{children}</AppThemeProvider></body>
    </html>
  );
}
