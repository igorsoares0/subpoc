import type { SubtitleStyle } from "./types";

/**
 * Per-word entrance animation math. Extracted so the live editor preview and
 * the real renderer (SubtitleTrack, captured frame-by-frame by the worker)
 * share one source of truth — the preview is guaranteed to match the output.
 */

export const POP_DURATION = 0.12;
export const BG_FADE_DURATION = 0.1;

export function easeOutBack(t: number, strength = 1): number {
  const c1 = 1.70158 * strength;
  const c3 = c1 + 1;
  const x = Math.min(Math.max(t, 0), 1);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function easeOutCubic(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - x, 3);
}

export type AnimMode = NonNullable<SubtitleStyle["animationMode"]>;
export type AnimIntensity = NonNullable<SubtitleStyle["animationIntensity"]>;

export interface WordAnimation {
  transform?: string;
  opacity?: number;
  /** 0→1 ramp for fading in a highlight background pill alongside the word. */
  bgProgress: number;
}

/** Per-mode entrance duration (seconds) at the `subtle` intensity baseline. */
export const ANIM_DURATION: Record<AnimMode, number> = {
  none: 0,
  pop: POP_DURATION,
  scale: 0.15,
  "slide-up": 0.18,
  fade: 0.18,
};

/**
 * Intensity knob (item: configurable animation strength). Scales three things
 * together: `dur` stretches how long the entrance plays (the baselines above
 * are only ~3–5 frames, which is why animations read as "subtle"); `mag`
 * scales how far the word travels / how small it starts; `overshoot` scales the
 * easeOutBack bounce past the rest position. `subtle` reproduces the original
 * look (×1 across the board); `medium` is the default so existing projects pick
 * up the more visible animation.
 */
export const ANIM_INTENSITY: Record<AnimIntensity, { dur: number; mag: number; overshoot: number }> = {
  subtle: { dur: 1, mag: 1, overshoot: 1 },
  medium: { dur: 2.2, mag: 1.6, overshoot: 1.5 },
  strong: { dur: 3, mag: 2.4, overshoot: 2.2 },
};

/** Total entrance duration (seconds) for a mode at a given intensity. Used by
 * the editor preview to time its replay loop. */
export function animDuration(mode: AnimMode, intensity: AnimIntensity): number {
  const k = ANIM_INTENSITY[intensity] ?? ANIM_INTENSITY.medium;
  return (ANIM_DURATION[mode] || POP_DURATION) * k.dur;
}

/**
 * Computes the entrance transform/opacity for the active word, `elapsed`
 * seconds after it became active. Each mode eases 0→1 over its (intensity-
 * scaled) duration and then holds at rest. At `subtle` intensity every mode
 * matches its original formula, so picking "subtle" reproduces the old look.
 */
export function computeWordAnimation(
  mode: AnimMode,
  elapsed: number,
  intensity: AnimIntensity,
): WordAnimation {
  const k = ANIM_INTENSITY[intensity] ?? ANIM_INTENSITY.medium;
  const dur = (ANIM_DURATION[mode] || POP_DURATION) * k.dur;
  const t = Math.min(Math.max(elapsed / dur, 0), 1);
  const bgProgress = Math.min(
    Math.max(elapsed / (BG_FADE_DURATION * k.dur), 0),
    1,
  );

  switch (mode) {
    case "pop":
      // scale(easeOutBack) grows 0→overshoot→1; overshoot scales with intensity.
      return { transform: `scale(${easeOutBack(t, k.overshoot)})`, bgProgress };
    case "scale": {
      const start = Math.max(1 - 0.4 * k.mag, 0.05);
      return {
        transform: `scale(${start + (1 - start) * easeOutBack(t, k.overshoot)})`,
        opacity: Math.min(t / 0.6, 1),
        bgProgress,
      };
    }
    case "slide-up": {
      const dy = (1 - easeOutBack(t, k.overshoot)) * 0.4 * k.mag; // em
      return { transform: `translateY(${dy}em)`, opacity: Math.min(t / 0.6, 1), bgProgress };
    }
    case "fade": {
      // Pure fade is inherently soft; pair it with a slight scale-up at higher
      // intensities so it still registers (start = 1 at subtle → pure fade).
      const start = Math.max(1 - 0.12 * (k.mag - 1), 0.7);
      return {
        transform: `scale(${start + (1 - start) * easeOutCubic(t)})`,
        opacity: easeOutCubic(t),
        bgProgress,
      };
    }
    default:
      return { bgProgress: 1 };
  }
}
