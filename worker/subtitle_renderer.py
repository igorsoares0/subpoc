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
from playwright.async_api import async_playwright


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
) -> tuple[list[tuple[float, float, str]], str]:
    """
    Drives the /render/[id] page and produces one full-frame transparent PNG
    per visual keyframe. Returns (schedule, blank_png).
    """
    if out_dir is None:
        out_dir = os.path.join(tempfile.gettempdir(), f"subs_{video_id}")
    os.makedirs(out_dir, exist_ok=True)

    keyframes = _build_keyframes(subtitles, style, trim_start)

    url = (
        f"{next_app_url.rstrip('/')}/render/{video_id}"
        f"?token={worker_secret}&w={video_width}&h={video_height}"
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

            # Blank frame — sample at a time where no subtitle is active.
            # Using -9999 guarantees no match in either display mode.
            await page.evaluate("window.__setTime(-9999)")
            await page.screenshot(path=blank_png, omit_background=True)

            # Dedup identical (sentence) keyframes by sample_t to avoid redundant
            # screenshots when, e.g., a subtitle spans a long duration.
            for idx, (start, end, sample_t) in enumerate(keyframes):
                png = os.path.join(out_dir, f"sub_{idx:05d}.png")
                await page.evaluate(f"window.__setTime({sample_t})")
                await page.screenshot(path=png, omit_background=True)
                schedule.append((start, end, png))
        finally:
            await browser.close()

    return schedule, blank_png


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


def _is_active(t_out: float, intervals: list[tuple[float, float]]) -> bool:
    """Linear scan — fine for typical subtitle counts (hundreds)."""
    for s, e in intervals:
        if t_out < s:
            return False
        if t_out < e:
            return True
    return False


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
) -> tuple[list[tuple[float, float, str]], str]:
    """
    Frame-by-frame capture for animated modes (Submagic-style pop).

    Samples the /render/[id] DOM at every frame of the output video; frames
    where no subtitle is active reuse a single blank PNG to keep disk/FFmpeg
    work linear in active-frame count, not total-frame count.

    Returns (schedule, blank_png) where each schedule entry covers one frame
    (duration = 1/fps). The caller's concat-demuxer builder already handles
    short per-entry durations.
    """
    if out_dir is None:
        out_dir = os.path.join(tempfile.gettempdir(), f"subs_{video_id}")
    os.makedirs(out_dir, exist_ok=True)

    intervals = _build_active_intervals(subtitles, style, trim_start)
    frame_dt = 1.0 / video_fps
    total_frames = max(1, int(round(effective_duration * video_fps)))

    url = (
        f"{next_app_url.rstrip('/')}/render/{video_id}"
        f"?token={worker_secret}&w={video_width}&h={video_height}"
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

            # Blank sample (far past any timestamp)
            await page.evaluate("window.__setTime(-9999)")
            await page.screenshot(path=blank_png, omit_background=True)

            active_count = 0
            for i in range(total_frames):
                t_out = i * frame_dt
                entry_start = t_out
                entry_end = t_out + frame_dt

                if not _is_active(t_out, intervals):
                    schedule.append((entry_start, entry_end, blank_png))
                    continue

                t_orig = t_out + trim_start
                png = os.path.join(out_dir, f"frame_{i:06d}.png")
                await page.evaluate(f"window.__setTime({t_orig})")
                await page.screenshot(path=png, omit_background=True)
                schedule.append((entry_start, entry_end, png))
                active_count += 1

            print(
                f"[SubRender/frame] Captured {active_count}/{total_frames} "
                f"active frames @ {video_fps:.2f}fps"
            )
        finally:
            await browser.close()

    return schedule, blank_png


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
) -> tuple[list[tuple[float, float, str]], str]:
    """
    Sync wrapper used by the CLI subprocess.

    Routes to framewise capture when style.animationMode == "pop" (needs both
    effective_duration and video_fps); otherwise uses the keyframe path.
    """
    animation_mode = (style or {}).get("animationMode", "none")
    use_framewise = (
        animation_mode == "pop"
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
        )
    )
