"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const MediaPlayer = dynamic(() => import("@/components/MediaPlayer"), {
  ssr: false,
});

export default function Home() {
  const pathname = usePathname();

  useEffect(() => {
    // Register service worker for PWA
    if ("serviceWorker" in navigator) {
      // Get the basePath from the current pathname
      const basePath = pathname.startsWith("/MiniPlay")
        ? "/MiniPlay"
        : "";

      navigator.serviceWorker
        .register(`${basePath}/sw.js`)
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => {
          console.error("SW registration failed:", err);
        });
    }
  }, [pathname]);

  return (
    <main className="w-screen h-screen bg-black overflow-hidden">
      <MediaPlayer />
    </main>
  );
}
