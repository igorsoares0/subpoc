"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { Subtitle, SubtitleStyle } from "./types";
import { resolveFontFamily } from "./fonts";
import { getWordGroupDisplay, normalizePosition } from "./word-group";

export interface SubtitleTrackProps {
  currentTime: number;
  subtitles: Subtitle[];
  style: SubtitleStyle;
  /** Rendered video size (preview dimensions in editor, native dimensions in worker). */
  videoWidth: number;
  videoHeight: number;
  /** Native video width — used to compute the scale factor so padding/outline match at any preview size. */
  nativeVideoWidth: number;
  /** Letterboxing offsets. Editor passes the centering offset; worker leaves at 0. */
  offsetX?: number;
  offsetY?: number;
  /**
   * Force a specific subtitle to render in sentence mode (editor uses this for manual selection).
   * Ignored in word-group mode. If omitted, the subtitle active at `currentTime` is used.
   */
  overrideSubtitle?: Subtitle | null;
  /** Editor-only: show the "re-transcribe to enable word-by-word" warning when word data is missing. */
  interactive?: boolean;
  isDragging?: boolean;
  onMouseDown?: (e: MouseEvent) => void;
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const POP_DURATION = 0.12;
const BG_FADE_DURATION = 0.1;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(Math.max(t, 0), 1);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Vector outline using -webkit-text-stroke + paint-order.
 * Replaces the old stacked text-shadow approach, which rasterized 9 copies
 * of the glyph and produced serrated edges under yuv420p chroma subsampling.
 * With paint-order: stroke fill, the stroke is painted under the fill so only
 * half the stroke width is visible outside the glyph — hence the ×2 multiplier
 * to roughly match the perceived thickness of the old outline-width value.
 */
function outlineStroke(
  outlineWidth: number,
  color: string,
  enabled: boolean,
): { WebkitTextStroke?: string; paintOrder?: string } {
  if (!enabled) return {};
  const w = Math.max(outlineWidth * 2, 2);
  return {
    WebkitTextStroke: `${w}px ${color}`,
    paintOrder: "stroke fill",
  };
}

export function SubtitleTrack({
  currentTime,
  subtitles,
  style,
  videoWidth,
  videoHeight,
  nativeVideoWidth,
  offsetX = 0,
  offsetY = 0,
  overrideSubtitle,
  interactive = false,
  isDragging = false,
  onMouseDown,
}: SubtitleTrackProps) {
  if (!videoWidth || !videoHeight) return null;

  const position = normalizePosition(style.position);
  const leftPx = offsetX + (position.x / 100) * videoWidth;
  const topPx = offsetY + (position.y / 100) * videoHeight;
  const scaleFactor = videoWidth / nativeVideoWidth;
  const boxPadding = Math.max(nativeVideoWidth * 0.015, 6) * scaleFactor;
  const fontSize = Math.max(style.fontSize * scaleFactor, 12);

  const interactiveWrapper: Partial<CSSProperties> = interactive
    ? { cursor: isDragging ? "grabbing" : "grab", pointerEvents: "auto" }
    : { pointerEvents: "none" };

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    left: `${leftPx}px`,
    top: `${topPx}px`,
    transform: "translate(-50%, -50%)",
    maxWidth: `${Math.min(videoWidth * 0.9, videoWidth - 32)}px`,
    ...interactiveWrapper,
  };

  const isWordGroupMode = style.displayMode === "word-group";
  const hasWordData = subtitles.some(
    (s) => s.words && s.words.length > 0,
  );

  // Word-group mode with word-level data
  if (isWordGroupMode && hasWordData) {
    const wordGroup = getWordGroupDisplay(
      subtitles,
      currentTime,
      style.wordsPerGroup || 3,
    );
    if (!wordGroup) return null;

    const containerBg =
      style.backgroundOpacity <= 0
        ? "transparent"
        : hexToRgba(style.backgroundColor, style.backgroundOpacity);

    // Any highlightBg means the active word gets a colored background pill —
    // in that case outline competes visually with it, so suppress it group-wide.
    const hasHighlightBg = !!style.highlightBg;
    const scaledOutlineWidth = Math.max(style.outlineWidth * scaleFactor, 1);
    const groupStrokeEnabled =
      style.outline && style.backgroundOpacity <= 0 && !hasHighlightBg;
    const groupStroke = outlineStroke(
      scaledOutlineWidth,
      style.outlineColor,
      groupStrokeEnabled,
    );

    const popEnabled = style.animationMode === "pop";
    const activeWord = wordGroup.words[wordGroup.activeIndex];

    return (
      <div style={wrapperStyle} onMouseDown={onMouseDown}>
        <div
          className="text-center"
          style={{
            padding: `${boxPadding}px`,
            fontFamily: resolveFontFamily(style.fontFamily),
            fontSize: `${fontSize}px`,
            fontWeight: style.fontWeight ?? 700,
            backgroundColor: containerBg,
          }}
        >
          {wordGroup.words.map((w, idx) => {
            const isActive = idx === wordGroup.activeIndex;
            const wordText = style.uppercase ? w.word.toUpperCase() : w.word;

            let popScale = 1;
            let bgProgress = 1;
            if (popEnabled && isActive && activeWord) {
              const elapsed = currentTime - activeWord.start;
              const popT = Math.min(Math.max(elapsed / POP_DURATION, 0), 1);
              popScale = 0.72 + (easeOutBack(popT) - 0.72);
              bgProgress = Math.min(
                Math.max(elapsed / BG_FADE_DURATION, 0),
                1,
              );
            }

            const baseHighlightOpacity = style.highlightBgOpacity ?? 0.95;
            const wordBg =
              isActive && style.highlightBg
                ? hexToRgba(
                    style.highlightBg,
                    baseHighlightOpacity * (popEnabled ? bgProgress : 1),
                  )
                : undefined;

            const activeColor = style.highlightBg
              ? style.highlightColor || "#FFFFFF"
              : style.highlightColor || "#FFD700";

            return (
              <span
                key={idx}
                style={{
                  ...groupStroke,
                  color: isActive ? activeColor : style.color,
                  marginRight:
                    idx < wordGroup.words.length - 1 ? "0.3em" : undefined,
                  backgroundColor: wordBg,
                  padding: wordBg ? "2px 6px" : undefined,
                  borderRadius: wordBg ? "8px" : undefined,
                  display: popEnabled ? "inline-block" : undefined,
                  transform:
                    popEnabled && isActive
                      ? `scale(${popScale})`
                      : undefined,
                  transformOrigin: popEnabled ? "center" : undefined,
                }}
              >
                {wordText}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Word-group mode selected but no word-level data — editor shows a hint.
  if (isWordGroupMode && !hasWordData) {
    if (!interactive) return null;
    return (
      <div
        className="absolute"
        style={{
          left: `${leftPx}px`,
          top: `${topPx}px`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
        }}
      >
        <div className="bg-yellow-900/80 text-yellow-200 px-4 py-2 rounded text-sm text-center max-w-[300px]">
          Word-level data not available. Re-transcribe the video to enable
          word-by-word display.
        </div>
      </div>
    );
  }

  // Sentence mode
  const sentenceSubtitle =
    overrideSubtitle ??
    subtitles.find(
      (sub) => currentTime >= sub.start && currentTime < sub.end,
    ) ??
    null;
  if (!sentenceSubtitle) return null;

  const displayText = style.uppercase
    ? sentenceSubtitle.text.toUpperCase()
    : sentenceSubtitle.text;

  const bg =
    style.backgroundOpacity <= 0
      ? "transparent"
      : hexToRgba(style.backgroundColor, style.backgroundOpacity);

  const sentenceScaledOutline = Math.max(style.outlineWidth * scaleFactor, 1);
  const sentenceStroke = outlineStroke(
    sentenceScaledOutline,
    style.outlineColor,
    style.outline && style.backgroundOpacity <= 0,
  );

  return (
    <div style={wrapperStyle} onMouseDown={onMouseDown}>
      <div
        style={{
          padding: `${boxPadding}px`,
          backgroundColor: bg,
          color: style.color,
          fontFamily: resolveFontFamily(style.fontFamily),
          fontSize: `${fontSize}px`,
          fontWeight: style.fontWeight ?? 700,
          textAlign: style.alignment as CSSProperties["textAlign"],
          ...sentenceStroke,
        }}
      >
        {displayText}
      </div>
    </div>
  );
}
