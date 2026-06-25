"use client";

import type { CSSProperties } from "react";
import type { HookOverlay as HookOverlayData } from "./types";
import { resolveFontFamily } from "./fonts";

export interface HookOverlayProps {
  hook: HookOverlayData | null | undefined;
  /** Rendered video size (preview dims in editor, native dims in worker). */
  videoWidth: number;
  videoHeight: number;
  /** Native source width — anchors the font scale to match across sizes. */
  nativeVideoWidth: number;
  /** Letterboxing offsets. Editor passes the centering offset; worker leaves 0. */
  offsetX?: number;
  offsetY?: number;
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Vector outline — mirrors SubtitleTrack's outlineStroke so the hook matches
// the subtitle's edge quality under yuv420p chroma subsampling.
function outlineStroke(
  outlineWidth: number,
  color: string,
  enabled: boolean,
): { WebkitTextStroke?: string; paintOrder?: string } {
  if (!enabled) return {};
  const w = Math.max(outlineWidth * 2, 2);
  return { WebkitTextStroke: `${w}px ${color}`, paintOrder: "stroke fill" };
}

/**
 * Renders the static hook/headline overlay. Shares the SubtitleTrack scaling
 * model (scaleFactor = videoWidth / nativeVideoWidth) so the editor preview and
 * the worker render produce the same size and position.
 */
export function HookOverlay({
  hook,
  videoWidth,
  videoHeight,
  nativeVideoWidth,
  offsetX = 0,
  offsetY = 0,
}: HookOverlayProps) {
  if (!hook || !hook.text || !hook.text.trim()) return null;
  if (!videoWidth || !videoHeight) return null;

  const position = hook.position ?? { x: 50, y: 12 };
  const leftPx = offsetX + (position.x / 100) * videoWidth;
  const topPx = offsetY + (position.y / 100) * videoHeight;
  const scaleFactor = videoWidth / nativeVideoWidth;
  const boxPadding = Math.max(nativeVideoWidth * 0.015, 6) * scaleFactor;
  const fontSize = Math.max(hook.fontSize * scaleFactor, 12);

  const bg =
    hook.backgroundOpacity <= 0
      ? "transparent"
      : hexToRgba(hook.backgroundColor, hook.backgroundOpacity);

  const scaledOutline = Math.max(hook.outlineWidth * scaleFactor, 1);
  const stroke = outlineStroke(
    scaledOutline,
    hook.outlineColor,
    hook.outline && hook.backgroundOpacity <= 0,
  );

  const text = hook.uppercase ? hook.text.toUpperCase() : hook.text;

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    left: `${leftPx}px`,
    top: `${topPx}px`,
    transform: "translate(-50%, -50%)",
    maxWidth: `${0.9 * videoWidth}px`,
    width: "max-content",
    pointerEvents: "none",
  };

  return (
    <div style={wrapperStyle}>
      <div
        style={{
          padding: `${boxPadding}px`,
          backgroundColor: bg,
          color: hook.color,
          fontFamily: resolveFontFamily(hook.fontFamily),
          fontSize: `${fontSize}px`,
          fontWeight: hook.fontWeight ?? 800,
          textAlign: "center",
          ...stroke,
        }}
      >
        {text}
      </div>
    </div>
  );
}
