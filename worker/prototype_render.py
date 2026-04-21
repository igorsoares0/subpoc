r"""
Phase 0 prototype: frame-by-frame subtitle render.

Captures N frames from the Next.js /prototype/subtitle route by driving
window.__setTime(t) via Playwright, then composes the PNG sequence with
FFmpeg over a black background to produce a playable MP4.

Run (in a second terminal, with `npm run dev` already running):
    cd worker
    source venv/bin/activate  # or: venv\Scripts\activate on Windows
    python prototype_render.py

Output:
    worker/prototype_output/prototype.mp4  <- the result
    worker/prototype_output/frames/*.png   <- raw frames (kept for inspection)

Prints a benchmark at the end: ms/frame + extrapolated render times for
1min and 5min videos.
"""

import argparse
import asyncio
import os
import subprocess
import time
from pathlib import Path

from playwright.async_api import async_playwright

WORKER_DIR = Path(__file__).parent
OUTPUT_DIR = WORKER_DIR / "prototype_output"
FRAMES_DIR = OUTPUT_DIR / "frames"

DEFAULT_URL = os.environ.get(
    "PROTOTYPE_URL", "http://localhost:3000/prototype/subtitle"
)


async def capture_frames(
    url: str, video_w: int, video_h: int, duration: float, fps: int, bbox: bool
) -> float:
    OUTPUT_DIR.mkdir(exist_ok=True)
    FRAMES_DIR.mkdir(exist_ok=True)
    for f in FRAMES_DIR.glob("frame_*.png"):
        f.unlink()

    total_frames = int(duration * fps)
    page_url = f"{url}?w={video_w}&h={video_h}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": video_w, "height": video_h},
            device_scale_factor=1,
        )
        page = await context.new_page()

        print(f"[proto] Navigating to {page_url}")
        await page.goto(page_url, wait_until="networkidle")
        await page.wait_for_function(
            "() => window.__ready === true", timeout=15000
        )
        print("[proto] Fonts ready, __setTime exposed.")

        clip = None
        if bbox:
            clip = {
                "x": 0,
                "y": int(video_h * 0.55),
                "width": video_w,
                "height": int(video_h * 0.35),
            }
            print(f"[proto] BBox capture: {clip}")

        print(f"[proto] Capturing {total_frames} frames at {fps}fps...")
        start = time.monotonic()

        for i in range(total_frames):
            t = i / fps
            await page.evaluate(f"window.__setTime({t})")
            out = FRAMES_DIR / f"frame_{i:06d}.png"
            kwargs = {"path": str(out), "omit_background": True}
            if clip:
                kwargs["clip"] = clip
            await page.screenshot(**kwargs)

        elapsed = time.monotonic() - start
        await browser.close()

    per_frame_ms = (elapsed / total_frames) * 1000
    print(f"\n[proto] === BENCHMARK ===")
    print(f"[proto] Captured: {total_frames} frames in {elapsed:.2f}s")
    print(f"[proto] Per frame: {per_frame_ms:.1f} ms")
    print(f"[proto] 1min video (1800 frames) ≈ {1800 * per_frame_ms / 1000:.0f}s")
    print(f"[proto] 5min video (9000 frames) ≈ {9000 * per_frame_ms / 60000:.1f}min")
    print(
        f"[proto] 10min video (18000 frames) ≈ {18000 * per_frame_ms / 60000:.1f}min"
    )
    return elapsed


def compose_video(
    video_w: int, video_h: int, duration: float, fps: int, bbox: bool
) -> None:
    output = OUTPUT_DIR / "prototype.mp4"
    filter_complex = (
        "[0:v][1:v]overlay=0:{y}:format=auto:shortest=1,format=yuv420p[v]"
    ).format(y=int(video_h * 0.55) if bbox else 0)

    cmd = [
        "ffmpeg",
        "-v", "error", "-y",
        "-f", "lavfi",
        "-i", f"color=c=black:s={video_w}x{video_h}:d={duration}:r={fps}",
        "-framerate", str(fps),
        "-i", str(FRAMES_DIR / "frame_%06d.png"),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        str(output),
    ]

    print("\n[proto] Composing MP4...")
    ff_start = time.monotonic()
    result = subprocess.run(cmd, capture_output=True, text=True)
    ff_elapsed = time.monotonic() - ff_start

    if result.returncode != 0:
        print(f"[proto] FFmpeg failed:\n{result.stderr}")
        return

    size_mb = output.stat().st_size / 1024 / 1024
    print(f"[proto] FFmpeg compose: {ff_elapsed:.2f}s")
    print(f"[proto] Output: {output} ({size_mb:.2f} MB)")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--duration", type=float, default=3.2)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument(
        "--bbox",
        action="store_true",
        help="Capture only the subtitle bounding box (faster).",
    )
    args = ap.parse_args()

    elapsed = await capture_frames(
        args.url, args.width, args.height, args.duration, args.fps, args.bbox
    )
    compose_video(args.width, args.height, args.duration, args.fps, args.bbox)
    print(f"\n[proto] Pipeline complete.")


if __name__ == "__main__":
    asyncio.run(main())
