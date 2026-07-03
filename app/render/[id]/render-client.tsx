"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  SubtitleTrack,
  HookOverlay,
  type Subtitle,
  type SubtitleStyle,
  type HookOverlayData,
} from "@/lib/subtitle-track";

declare global {
  interface Window {
    __setTime?: (t: number) => Promise<void>;
    /** Sync variant without the paint-wait rAFs — for layout-only reads
     * (getBoundingClientRect) in the worker's clip-measure pass. */
    __setTimeSync?: (t: number) => void;
    __ready?: boolean;
  }
}

interface Props {
  subtitles: Subtitle[];
  style: SubtitleStyle;
  hook?: HookOverlayData | null;
  videoWidth: number;
  videoHeight: number;
  nativeVideoWidth: number;
}

export function RenderClient({ subtitles, style, hook, videoWidth, videoHeight, nativeVideoWidth }: Props) {
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
      window.__setTimeSync = (t: number) => {
        flushSync(() => setCurrentTime(t));
      };
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
          nativeVideoWidth={nativeVideoWidth}
        />
        <HookOverlay
          hook={hook}
          videoWidth={videoWidth}
          videoHeight={videoHeight}
          nativeVideoWidth={nativeVideoWidth}
        />
      </div>
    </>
  );
}
