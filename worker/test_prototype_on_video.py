"""
Isolation test: renders the Phase 0 prototype subtitle (AnimatedSubtitle,
Montserrat 900, pop animation, red highlight) onto the first ~3s of a real
video from disk. Uses the SAME FFmpeg pipeline as worker/rendering.py so we
can see whether the quality gap is in the subtitle rasterization (browser)
or in the video pipeline (encode/overlay).

Prereqs: `npm run dev` running on :3000, playwright installed in venv.

Usage:
    python test_prototype_on_video.py --video "C:\\path\\to\\video.mp4"
    python test_prototype_on_video.py --video /mnt/c/path/to/video.mp4
"""

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

WORKER_DIR = Path(__file__).parent
OUTPUT_DIR = WORKER_DIR / "prototype_output"
FRAMES_DIR = OUTPUT_DIR / "real_frames"
PROTOTYPE_URL = os.environ.get(
    "PROTOTYPE_URL", "http://localhost:3000/prototype/subtitle"
)


def normalize_path(p: str) -> str:
    """Convert `C:\\...` → `/mnt/c/...` only when running under Linux/WSL."""
    if sys.platform.startswith("linux") and re.match(r"^[A-Za-z]:[\\/]", p):
        drive = p[0].lower()
        rest = p[2:].replace("\\", "/").lstrip("/")
        return f"/mnt/{drive}/{rest}"
    return p


def probe_video(path: str) -> dict:
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_streams", "-show_format",
            "-select_streams", "v:0", path,
        ],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(result.stdout)
    s = data["streams"][0]
    fps_str = s.get("r_frame_rate", "30/1")
    num, den = fps_str.split("/")
    fps = float(num) / float(den) if float(den) else 30.0
    return {
        "width": int(s["width"]),
        "height": int(s["height"]),
        "fps": fps,
        "duration": float(data["format"]["duration"]),
    }


async def capture_frames(
    video_w: int, video_h: int, duration: float, fps: float
) -> int:
    if FRAMES_DIR.exists():
        shutil.rmtree(FRAMES_DIR)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    total = int(round(duration * fps))
    page_url = f"{PROTOTYPE_URL}?w={video_w}&h={video_h}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                viewport={"width": video_w, "height": video_h},
                device_scale_factor=2,  # same as production pipeline
            )
            page = await context.new_page()
            print(f"[test] Opening {page_url}")
            await page.goto(page_url, wait_until="networkidle")
            await page.wait_for_function("() => window.__ready === true", timeout=20000)

            t0 = time.monotonic()
            for i in range(total):
                t = i / fps
                await page.evaluate(f"window.__setTime({t})")
                await page.screenshot(
                    path=str(FRAMES_DIR / f"frame_{i:06d}.png"),
                    omit_background=True,
                )
            elapsed = time.monotonic() - t0
            print(f"[test] Captured {total} frames in {elapsed:.1f}s "
                  f"({elapsed * 1000 / total:.0f} ms/frame)")
        finally:
            await browser.close()

    return total


def compose_video(
    video_path: str, video_w: int, video_h: int,
    duration: float, fps: float, output: Path,
) -> None:
    """Mirror worker/rendering.py FFmpeg pipeline exactly."""
    fps_val = round(fps, 3)
    filter_complex = (
        f"[0:v]trim=duration={duration},setpts=PTS-STARTPTS[base];"
        f"[1:v]fps={fps_val},setpts=PTS-STARTPTS,"
        f"scale={video_w}:{video_h}:flags=lanczos,format=rgba[subs];"
        f"[base][subs]overlay=0:0:format=rgb:shortest=1[withsubs];"
        f"[withsubs]scale=iw:ih:in_color_matrix=bt709:out_color_matrix=bt709,"
        f"format=yuv420p[out]"
    )
    cmd = [
        "ffmpeg", "-v", "info", "-y",
        "-i", video_path,
        "-framerate", str(fps_val),
        "-i", str(FRAMES_DIR / "frame_%06d.png"),
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-map", "0:a?",
        "-t", f"{duration:.6f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-colorspace", "bt709", "-color_primaries", "bt709",
        "-color_trc", "bt709", "-color_range", "tv",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(output),
    ]
    print(f"[test] Running FFmpeg...")
    ff_start = time.monotonic()
    r = subprocess.run(cmd, capture_output=True, text=True)
    ff_elapsed = time.monotonic() - ff_start
    if r.returncode != 0:
        print(f"[test] FFmpeg FAILED:\n{r.stderr[-2000:]}")
        raise SystemExit(1)
    size_mb = output.stat().st_size / 1024 / 1024
    print(f"[test] Compose: {ff_elapsed:.1f}s → {output} ({size_mb:.2f} MB)")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, help="Path to source video")
    ap.add_argument("--duration", type=float, default=3.2,
                    help="Seconds to render (prototype has 3.2s of words)")
    ap.add_argument("--output", default=str(OUTPUT_DIR / "real_video_test.mp4"))
    args = ap.parse_args()

    video_path = normalize_path(args.video)
    if not os.path.exists(video_path):
        raise SystemExit(f"Video not found: {video_path}")

    OUTPUT_DIR.mkdir(exist_ok=True)

    info = probe_video(video_path)
    duration = min(args.duration, info["duration"])
    print(f"[test] Source: {info['width']}x{info['height']} @ {info['fps']:.2f}fps "
          f"(using first {duration:.2f}s)")

    await capture_frames(info["width"], info["height"], duration, info["fps"])
    compose_video(
        video_path, info["width"], info["height"],
        duration, info["fps"], Path(args.output),
    )
    print(f"\n[test] Done. Open: {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
