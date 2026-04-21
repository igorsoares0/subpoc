"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  AnimatedSubtitle,
  PROTOTYPE_WORDS,
} from "@/components/prototype/AnimatedSubtitle";

declare global {
  interface Window {
    __setTime?: (t: number) => Promise<void>;
    __ready?: boolean;
  }
}

export default function PrototypeSubtitlePage() {
  const [currentTime, setCurrentTime] = useState(0);
  const [dims, setDims] = useState({ w: 1080, h: 1920 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const w = parseInt(sp.get("w") || "1080", 10);
    const h = parseInt(sp.get("h") || "1920", 10);
    setDims({ w, h });

    document.fonts.ready.then(() => {
      window.__setTime = (t: number) =>
        new Promise<void>((resolve) => {
          flushSync(() => setCurrentTime(t));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
      window.__ready = true;
      setReady(true);
    });
  }, []);

  return (
    <>
      <style>{`
        html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }
        #__next, main, body > div { background: transparent !important; }
      `}</style>
      <div
        data-ready={ready ? "1" : "0"}
        style={{
          width: `${dims.w}px`,
          height: `${dims.h}px`,
          background: "transparent",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <AnimatedSubtitle
          currentTime={currentTime}
          words={PROTOTYPE_WORDS}
          wordsPerGroup={3}
          videoWidth={dims.w}
          videoHeight={dims.h}
        />
      </div>
    </>
  );
}
