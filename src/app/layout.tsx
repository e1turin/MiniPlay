import type { Metadata, Viewport } from "next";
import "./globals.css";

const BASENAME = "/zai-miniplayer";

export const viewport: Viewport = {
  width: "420",
  height: "280",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "MiniPlay",
  description: "A minimalistic offline media player PWA",
  manifest: `${BASENAME}/manifest.json`,
  icons: {
    icon: `${BASENAME}/icon-512.png`,
    apple: `${BASENAME}/icon-512.png`,
  },
  appleWebApp: {
    capable: true,
    standalone: true,
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href={`${BASENAME}/icon-512.png`} />
      </head>
      <body className="antialiased bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
