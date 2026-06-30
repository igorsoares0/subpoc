"use client";

import { useEffect, useRef, useState } from "react";
import {
  animDuration,
  computeWordAnimation,
  type AnimIntensity,
  type AnimMode,
} from "@/lib/subtitle-track/animation";
import { resolveFontFamily } from "@/lib/subtitle-track/fonts";

interface AnimationPreviewProps {
  mode: AnimMode;
  intensity: AnimIntensity;
  /** Sample word colour — defaults to the active-word highlight gold. */
  color?: string;
  fontFamily?: string;
  uppercase?: boolean;
  /** Sample word shown animating. */
  word?: string;
}

/** How long the word holds at rest before the loop replays (seconds). */
const HOLD = 0.9;

/**
 * Loops the selected per-word entrance animation on a sample word so the user
 * sees the effect of mode/intensity live, without scrubbing the timeline. Uses
 * the exact same `computeWordAnimation` the renderer captures, so the preview
 * matches the final video.
 */
export function AnimationPreview({
  mode,
  intensity,
  color = "#FFD700",
  fontFamily = "Montserrat",
  uppercase = true,
  word = "Word",
}: AnimationPreviewProps) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const enabled = mode !== "none";
  const dur = animDuration(mode, intensity);
  const cycle = dur + HOLD;

  useEffect(() => {
    if (!enabled) {
      setElapsed(0);
      return;
    }
    // Restart the loop from t=0 whenever mode/intensity changes.
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = ((now - startRef.current) / 1000) % cycle;
      setElapsed(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, cycle, mode, intensity]);

  const anim = enabled
    ? computeWordAnimation(mode, elapsed, intensity)
    : { bgProgress: 1 };
  const label = uppercase ? word.toUpperCase() : word;

  return (
    <div className="mt-3 flex h-16 items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-black/40">
      <span
        style={{
          display: "inline-block",
          fontFamily: resolveFontFamily(fontFamily),
          fontSize: 26,
          fontWeight: 800,
          color: enabled ? color : "#71717a",
          transform: anim.transform,
          opacity: anim.opacity ?? 1,
          willChange: "transform, opacity",
        }}
      >
        {enabled ? label : "No animation"}
      </span>
    </div>
  );
}
