"use client";

import type { CSSProperties } from "react";

export interface ProtoWord {
  word: string;
  start: number;
  end: number;
}

export interface AnimatedSubtitleProps {
  currentTime: number;
  words: ProtoWord[];
  wordsPerGroup: number;
  videoWidth: number;
  videoHeight: number;
}

const POP_DURATION = 0.12;
const BG_FADE_DURATION = 0.1;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(Math.max(t, 0), 1);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function findActiveWordIndex(words: ProtoWord[], t: number): number {
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].start && t < words[i].end) return i;
  }
  return -1;
}

function groupRange(activeIdx: number, wordsPerGroup: number, total: number) {
  if (activeIdx < 0) return null;
  const groupIdx = Math.floor(activeIdx / wordsPerGroup);
  const start = groupIdx * wordsPerGroup;
  const end = Math.min(start + wordsPerGroup, total);
  return { start, end, localActive: activeIdx - start };
}

export function AnimatedSubtitle({
  currentTime,
  words,
  wordsPerGroup,
  videoWidth,
  videoHeight,
}: AnimatedSubtitleProps) {
  const activeIdx = findActiveWordIndex(words, currentTime);
  const group = groupRange(activeIdx, wordsPerGroup, words.length);

  if (!group) return null;

  const visible = words.slice(group.start, group.end);
  const fontSize = Math.round(videoWidth * 0.055);

  const containerStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "78%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: `${Math.round(fontSize * 0.25)}px`,
    maxWidth: `${Math.round(videoWidth * 0.9)}px`,
    fontFamily: "var(--font-montserrat), sans-serif",
    fontWeight: 900,
    fontSize: `${fontSize}px`,
    textTransform: "uppercase",
    letterSpacing: "-0.01em",
    lineHeight: 1.1,
  };

  return (
    <div style={containerStyle}>
      {visible.map((w, idx) => {
        const isActive = idx === group.localActive;
        const popProgress = isActive
          ? Math.min((currentTime - w.start) / POP_DURATION, 1)
          : 1;
        const scale = isActive ? 0.72 + (easeOutBack(popProgress) - 0.72) : 1;
        const bgProgress = isActive
          ? Math.min((currentTime - w.start) / BG_FADE_DURATION, 1)
          : 0;

        const shadowW = Math.max(2, Math.round(fontSize * 0.04));
        const textShadow = [
          `${shadowW}px 0 0 #000`,
          `-${shadowW}px 0 0 #000`,
          `0 ${shadowW}px 0 #000`,
          `0 -${shadowW}px 0 #000`,
          `${shadowW}px ${shadowW}px 0 #000`,
          `-${shadowW}px -${shadowW}px 0 #000`,
          `${shadowW}px -${shadowW}px 0 #000`,
          `-${shadowW}px ${shadowW}px 0 #000`,
        ].join(", ");

        const wordStyle: CSSProperties = {
          color: isActive ? "#FFE14A" : "#FFFFFF",
          transform: `scale(${scale})`,
          transformOrigin: "center",
          display: "inline-block",
          padding: `${Math.round(fontSize * 0.1)}px ${Math.round(fontSize * 0.2)}px`,
          borderRadius: `${Math.round(fontSize * 0.15)}px`,
          backgroundColor: isActive
            ? `rgba(230, 57, 70, ${0.95 * bgProgress})`
            : "transparent",
          textShadow: isActive && bgProgress < 1 ? textShadow : "none",
          transition: "none",
        };

        return (
          <span key={group.start + idx} style={wordStyle}>
            {w.word}
          </span>
        );
      })}
    </div>
  );
}

export const PROTOTYPE_WORDS: ProtoWord[] = [
  { word: "this", start: 0.0, end: 0.35 },
  { word: "is", start: 0.35, end: 0.6 },
  { word: "submagic", start: 0.6, end: 1.1 },
  { word: "style", start: 1.15, end: 1.5 },
  { word: "word", start: 1.55, end: 1.85 },
  { word: "by", start: 1.85, end: 2.05 },
  { word: "word", start: 2.05, end: 2.35 },
  { word: "with", start: 2.4, end: 2.65 },
  { word: "pop", start: 2.7, end: 3.1 },
];
