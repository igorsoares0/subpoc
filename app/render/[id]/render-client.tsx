"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  SubtitleTrack,
  type Subtitle,
  type SubtitleStyle,
} from "@/lib/subtitle-track";

declare global {
  interface Window {
    __setTime?: (t: number) => Promise<void>;
    __ready?: boolean;
  }
}

interface Props {
  subtitles: Subtitle[];
  style: SubtitleStyle;
  videoWidth: number;
  videoHeight: number;
}

export function RenderClient({ subtitles, style, videoWidth, videoHeight }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
          width: `${videoWidth}px`,
          height: `${videoHeight}px`,
          background: "transparent",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <SubtitleTrack
          currentTime={currentTime}
          subtitles={subtitles}
          style={style}
          videoWidth={videoWidth}
          videoHeight={videoHeight}
          nativeVideoWidth={videoWidth}
        />
      </div>
    </>
  );
}
