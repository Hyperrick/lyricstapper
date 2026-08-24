import type { Metadata } from "next";
import "@fontsource/creepster/400.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/league-spartan/wght.css";
import "@fontsource-variable/lexend/wght.css";
import "@fontsource-variable/montserrat/wght.css";
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
