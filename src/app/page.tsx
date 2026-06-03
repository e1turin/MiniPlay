"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

const MediaPlayer = dynamic(() => import("@/components/MediaPlayer"), {
  ssr: false,
});

export default function Home() {
  useEffect(() => {
    // Register service worker for PWA
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => {
          console.error("SW registration failed:", err);
        });
    }
  }, []);

  return (
    <main className="w-screen h-screen bg-black overflow-hidden">
      <MediaPlayer />
    </main>
  );
}
