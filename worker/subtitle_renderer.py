"""
Subtitle renderer via Next.js /render/[id] route.

Opens the /render/[id] page in headless Chromium, drives window.__setTime(t)
to capture full-frame transparent PNGs at each visual key-moment, and returns
(schedule, blank_png) — the same contract the old in-Python HTML renderer had,
so FFmpeg concat-demuxer composition downstream is unchanged.

The display-mode logic (sentence vs word-group) lives entirely in
<SubtitleTrack /> now; this file only schedules which timestamps to sample.
"""

import asyncio
import os
import tempfile
import time
from playwright.async_api import async_playwright

# Mirrors lib/subtitle-track/animation.ts (ANIM_DURATION × ANIM_INTENSITY.dur).
# Overestimating is safe — it only costs extra screenshots, never wrong pixels —
# so the 1.5× margin and the max-value fallbacks absorb drift if the TS
# constants change without this mirror being updated.
_ANIM_DURATION = {
    "pop": 0.12,
    "scale": 0.15,
    "slide-up": 0.18,
    "fade": 0.18,
}
_ANIM_DUR_MULT = {"subtle": 1.0, "medium": 2.2, "strong": 3.0}


def _anim_settle_time(style: dict) -> float:
    """
    Seconds after a word becomes active until its entrance animation has fully
    rested (transform, opacity and bgProgress all saturated). Past this point
    the DOM is static until the active word changes.
    """
    mode = (style or {}).get("animationMode", "none")
    if mode in (None, "", "none"):
        return 0.0
    intensity = (style or {}).get("animationIntensity", "medium")
    dur = _ANIM_DURATION.get(mode, 0.18) * _ANIM_DUR_MULT.get(intensity, 3.0)
    return dur * 1.5


# Padding (CSS px) added around the measured union — covers the half of the
# -webkit-text-stroke that paints outside the glyph box and antialiasing.
_CLIP_PAD = 16

# Sets the page time WITHOUT waiting for paint (getBoundingClientRect forces
# layout synchronously, which is all we need) and returns the union rect of
# everything visible — subtitles and hook overlay alike.
_MEASURE_JS = """
(t) => {
  if (!window.__setTimeSync) return { unsupported: true };
  window.__setTimeSync(t);
  const root = document.querySelector('[data-ready]');
  if (!root) return { unsupported: true };
  let u = null;
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (!u) u = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    else {
      u.l = Math.min(u.l, r.left);
      u.t = Math.min(u.t, r.top);
      u.r = Math.max(u.r, r.right);
      u.b = Math.max(u.b, r.bottom);
    }
  }
  return u;
}
"""


async def _measure_clip(
    page, times: list[float], video_width: int, video_height: int
) -> dict | None:
    """
    Fixed screenshot clip region covering everything the page paints at the
    given (original-timeline) sample times: the union of all bounding boxes,
    padded by _CLIP_PAD and clamped to the viewport.

    Returns {"x", "y", "w", "h"} in CSS px, or None when clipping should be
    skipped (page without __setTimeSync, nothing visible, or the union covers
    most of the frame so clipping wouldn't pay for itself). All screenshots —
    including the blank — must then share this clip so the concat frames have
    uniform dimensions; the FFmpeg overlay is offset by (x, y) to compensate.
    """
    left = top = right = bottom = None
    for t in times:
        rect = await page.evaluate(_MEASURE_JS, t)
        if rect is None:
            continue
        if rect.get("unsupported"):
            return None
        if left is None:
            left, top, right, bottom = rect["l"], rect["t"], rect["r"], rect["b"]
        else:
            left = min(left, rect["l"])
            top = min(top, rect["t"])
            right = max(right, rect["r"])
            bottom = max(bottom, rect["b"])

    if left is None:
        return None

    x = max(0, int(left - _CLIP_PAD))
    y = max(0, int(top - _CLIP_PAD))
    x2 = min(video_width, int(right + _CLIP_PAD) + 1)
    y2 = min(video_height, int(bottom + _CLIP_PAD) + 1)
    w, h = x2 - x, y2 - y
    if w <= 0 or h <= 0:
        return None
    if w * h >= 0.8 * video_width * video_height:
        return None
    return {"x": x, "y": y, "w": w, "h": h}


def _build_keyframes(
    subtitles: list[dict],
    style: dict,
    trim_start: float,
) -> list[tuple[float, float, float]]:
    """
    Returns (start, end, sample_t) tuples where:
      - start/end are in the post-trim output timeline
      - sample_t is in the original (pre-trim) timeline (what __setTime expects)

    sentence mode    → one keyframe per subtitle
    word-group mode  → one keyframe per active word
    """
    display_mode = (style or {}).get("displayMode", "sentence")
    keyframes: list[tuple[float, float, float]] = []

    if display_mode == "word-group":
        for sub in subtitles:
            for w in sub.get("words", []) or []:
                orig_start = float(w.get("start", 0))
                orig_end = float(w.get("end", 0))
                out_end = orig_end - trim_start
                if out_end <= 0 or orig_end <= orig_start:
                    continue
                out_start = max(0.0, orig_start - trim_start)
                # sample at a stable point inside the word (avoid boundary races)
                sample_t = orig_start + (orig_end - orig_start) * 0.5
                keyframes.append((out_start, out_end, sample_t))
    else:
        for sub in subtitles:
            text = (sub.get("text") or "").strip()
            if not text:
                continue
            orig_start = float(sub.get("start", 0))
            orig_end = float(sub.get("end", 0))
            out_end = orig_end - trim_start
            if out_end <= 0 or orig_end <= orig_start:
                continue
            out_start = max(0.0, orig_start - trim_start)
            sample_t = orig_start + (orig_end - orig_start) * 0.5
            keyframes.append((out_start, out_end, sample_t))

    keyframes.sort(key=lambda x: x[0])
    return keyframes


async def render_subtitles_via_browser(
    video_id: str,
    subtitles: list[dict],
    style: dict,
    video_width: int,
    video_height: int,
    trim_start: float,
    next_app_url: str,
    worker_secret: str,
    out_dir: str | None = None,
    native_width: int | None = None,
) -> tuple[list[tuple[float, float, str]], str, dict | None]:
    """
    Drives the /render/[id] page and produces one transparent PNG per visual
    keyframe, clipped to the measured subtitle/hook region when possible.
    Returns (schedule, blank_png, clip).
    """
    if out_dir is None:
        out_dir = os.path.join(tempfile.gettempdir(), f"subs_{video_id}")
    os.makedirs(out_dir, exist_ok=True)

    keyframes = _build_keyframes(subtitles, style, trim_start)

    nw = native_width if native_width else video_width
    url = (
        f"{next_app_url.rstrip('/')}/render/{video_id}"
        f"?token={worker_secret}&w={video_width}&h={video_height}&nw={nw}"
    )

    schedule: list[tuple[float, float, str]] = []
    blank_png = os.path.join(out_dir, "blank.png")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                viewport={"width": video_width, "height": video_height},
                # 2x supersampling: Chromium rasterizes text in 2x, screenshot
                # comes back at 2x resolution. FFmpeg downscales with lanczos,
                # producing much sharper glyph edges than DSF=1 (which matches
                # what the user sees in the editor on a retina/HiDPI display).
                device_scale_factor=2,
            )
            page = await context.new_page()

            print(f"[SubRender] Navigating: {url}")
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_function(
                "() => window.__ready === true", timeout=20000
            )
            print(f"[SubRender] Ready. Keyframes: {len(keyframes)}")

            # Measure the fixed clip region over every state we'll capture
            # (-9999 = blank/hook-only state).
            clip = await _measure_clip(
                page,
                [-9999.0] + [kf[2] for kf in keyframes],
                video_width,
                video_height,
            )
            shot_kwargs: dict = {"omit_background": True}
            if clip:
                print(f"[SubRender] Clip region: {clip}")
                shot_kwargs["clip"] = {
                    "x": clip["x"], "y": clip["y"],
                    "width": clip["w"], "height": clip["h"],
                }

            # Blank frame — sample at a time where no subtitle is active.
            # Using -9999 guarantees no match in either display mode.
            await page.evaluate("window.__setTime(-9999)")
            await page.screenshot(path=blank_png, **shot_kwargs)

            # Dedup identical (sentence) keyframes by sample_t to avoid redundant
            # screenshots when, e.g., a subtitle spans a long duration.
            for idx, (start, end, sample_t) in enumerate(keyframes):
                png = os.path.join(out_dir, f"sub_{idx:05d}.png")
                await page.evaluate(f"window.__setTime({sample_t})")
                await page.screenshot(path=png, **shot_kwargs)
                schedule.append((start, end, png))
        finally:
            await browser.close()

    return schedule, blank_png, clip


def _build_active_intervals(
    subtitles: list[dict],
    style: dict,
    trim_start: float,
) -> list[tuple[float, float]]:
    """
    Post-trim time intervals where *any* subtitle/word is active.
    Used by the framewise renderer to skip empty frames.
    """
    display_mode = (style or {}).get("displayMode", "sentence")
    intervals: list[tuple[float, float]] = []

    if display_mode == "word-group":
        for sub in subtitles:
            for w in sub.get("words", []) or []:
                s = float(w.get("start", 0)) - trim_start
                e = float(w.get("end", 0)) - trim_start
                if e > 0 and e > s:
                    intervals.append((max(0.0, s), e))
    else:
        for sub in subtitles:
            if not (sub.get("text") or "").strip():
                continue
            s = float(sub.get("start", 0)) - trim_start
            e = float(sub.get("end", 0)) - trim_start
            if e > 0 and e > s:
                intervals.append((max(0.0, s), e))

    intervals.sort()
    return intervals


def _active_interval_index(
    t_out: float, intervals: list[tuple[float, float]]
) -> int | None:
    """First interval containing t_out, or None. Linear scan — fine for
    typical subtitle counts (hundreds)."""
    for i, (s, e) in enumerate(intervals):
        if t_out < s:
            return None
        if t_out < e:
            return i
    return None


async def render_subtitles_framewise(
    video_id: str,
    subtitles: list[dict],
    style: dict,
    video_width: int,
    video_height: int,
    trim_start: float,
    effective_duration: float,
    video_fps: float,
    next_app_url: str,
    worker_secret: str,
    out_dir: str | None = None,
    native_width: int | None = None,
) -> tuple[list[tuple[float, float, str]], str, dict | None]:
    """
    Frame-by-frame capture for animated modes (Submagic-style pop).

    Samples the /render/[id] DOM at every frame of the output video. Two kinds
    of frames skip the (expensive) screenshot: frames with no active subtitle
    reuse a single blank PNG, and frames past the entrance-animation window of
    the active word reuse one settled PNG per word — the DOM is static there,
    so screenshot work is linear in *animating*-frame count, not total.

    Returns (schedule, blank_png, clip) where each schedule entry covers one
    frame (duration = 1/fps). The caller's concat-demuxer builder already
    handles short per-entry durations.
    """
    if out_dir is None:
        out_dir = os.path.join(tempfile.gettempdir(), f"subs_{video_id}")
    os.makedirs(out_dir, exist_ok=True)

    intervals = _build_active_intervals(subtitles, style, trim_start)
    settle_time = _anim_settle_time(style)
    frame_dt = 1.0 / video_fps
    total_frames = max(1, int(round(effective_duration * video_fps)))

    nw = native_width if native_width else video_width
    url = (
        f"{next_app_url.rstrip('/')}/render/{video_id}"
        f"?token={worker_secret}&w={video_width}&h={video_height}&nw={nw}"
    )

    schedule: list[tuple[float, float, str]] = []
    blank_png = os.path.join(out_dir, "blank.png")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                viewport={"width": video_width, "height": video_height},
                # 2x supersampling: Chromium rasterizes text in 2x, screenshot
                # comes back at 2x resolution. FFmpeg downscales with lanczos,
                # producing much sharper glyph edges than DSF=1 (which matches
                # what the user sees in the editor on a retina/HiDPI display).
                device_scale_factor=2,
            )
            page = await context.new_page()

            print(f"[SubRender/frame] Navigating: {url}")
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_function(
                "() => window.__ready === true", timeout=20000
            )

            # Plan every frame before touching the page: which are blank,
            # which reuse a settled PNG, and which need a real screenshot —
            # so the clip measurement below samples exactly the captured
            # states.
            plan: list[tuple[float, int | None, bool]] = []
            capture_times: list[float] = []
            planned_settled: set[int] = set()
            for i in range(total_frames):
                t_out = i * frame_dt
                idx = _active_interval_index(t_out, intervals)
                settled = (
                    idx is not None
                    and (t_out - intervals[idx][0]) >= settle_time
                )
                plan.append((t_out, idx, settled))
                if idx is None:
                    continue
                if not settled:
                    capture_times.append(t_out + trim_start)
                elif idx not in planned_settled:
                    planned_settled.add(idx)
                    capture_times.append(t_out + trim_start)

            # Fixed clip region over all captured states (layout-only pass,
            # ~1-2ms per sample — no paint wait).
            measure_start = time.perf_counter()
            clip = await _measure_clip(
                page, [-9999.0] + capture_times, video_width, video_height
            )
            print(
                f"[SubRender/frame] Clip: {clip} "
                f"(measured {len(capture_times) + 1} states "
                f"in {time.perf_counter() - measure_start:.1f}s)"
            )
            shot_kwargs: dict = {"omit_background": True}
            if clip:
                shot_kwargs["clip"] = {
                    "x": clip["x"], "y": clip["y"],
                    "width": clip["w"], "height": clip["h"],
                }

            # Blank sample (far past any timestamp)
            await page.evaluate("window.__setTime(-9999)")
            await page.screenshot(path=blank_png, **shot_kwargs)

            capture_start = time.perf_counter()
            captured = 0
            reused = 0
            settled_pngs: dict[int, str] = {}
            for i, (t_out, idx, settled) in enumerate(plan):
                entry_start = t_out
                entry_end = t_out + frame_dt

                if idx is None:
                    schedule.append((entry_start, entry_end, blank_png))
                    continue

                if settled and idx in settled_pngs:
                    schedule.append((entry_start, entry_end, settled_pngs[idx]))
                    reused += 1
                    continue

                t_orig = t_out + trim_start
                png = os.path.join(out_dir, f"frame_{i:06d}.png")
                await page.evaluate(f"window.__setTime({t_orig})")
                await page.screenshot(path=png, **shot_kwargs)
                schedule.append((entry_start, entry_end, png))
                captured += 1
                if settled:
                    settled_pngs[idx] = png

            print(
                f"[SubRender/frame] {captured} screenshots + {reused} settled "
                f"reuses over {total_frames} frames @ {video_fps:.2f}fps "
                f"in {time.perf_counter() - capture_start:.1f}s "
                f"(settle window {settle_time:.2f}s)"
            )
        finally:
            await browser.close()

    return schedule, blank_png, clip


def render_subtitles_via_browser_sync(
    video_id: str,
    subtitles: list[dict],
    style: dict,
    video_width: int,
    video_height: int,
    trim_start: float,
    next_app_url: str,
    worker_secret: str,
    out_dir: str | None = None,
    effective_duration: float | None = None,
    video_fps: float | None = None,
    native_width: int | None = None,
) -> tuple[list[tuple[float, float, str]], str, dict | None]:
    """
    Sync wrapper used by the CLI subprocess.

    Routes to framewise capture for any per-word entrance animation (needs both
    effective_duration and video_fps); otherwise uses the keyframe path.
    """
    animation_mode = (style or {}).get("animationMode", "none")
    is_animated = animation_mode not in (None, "", "none")
    use_framewise = (
        is_animated
        and effective_duration is not None
        and video_fps is not None
        and video_fps > 0
    )

    if use_framewise:
        return asyncio.run(
            render_subtitles_framewise(
                video_id=video_id,
                subtitles=subtitles,
                style=style,
                video_width=video_width,
                video_height=video_height,
                trim_start=trim_start,
                effective_duration=effective_duration,
                video_fps=video_fps,
                next_app_url=next_app_url,
                worker_secret=worker_secret,
                out_dir=out_dir,
                native_width=native_width,
            )
        )

    return asyncio.run(
        render_subtitles_via_browser(
            video_id=video_id,
            subtitles=subtitles,
            style=style,
            video_width=video_width,
            video_height=video_height,
            trim_start=trim_start,
            next_app_url=next_app_url,
            worker_secret=worker_secret,
            out_dir=out_dir,
            native_width=native_width,
        )
    )
