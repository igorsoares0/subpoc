"""
CLI entry point for subtitle PNG rendering.

Runs in a separate subprocess to avoid Playwright's event loop conflicting
with uvicorn's asyncio loop on Windows. Takes a JSON job file, drives the
Next.js /render/[id] route via headless Chromium, and writes a JSON result
file with (schedule, blank_png).
"""

import sys
import json
from subtitle_renderer import render_subtitles_via_browser_sync


def main():
    if len(sys.argv) != 3:
        print(
            "Usage: render_subtitles_cli.py <input.json> <output.json>",
            file=sys.stderr,
        )
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        job = json.load(f)

    schedule, blank_png = render_subtitles_via_browser_sync(
        video_id=job["video_id"],
        subtitles=job["subtitles"],
        style=job["style"],
        video_width=job["video_width"],
        video_height=job["video_height"],
        trim_start=job.get("trim_start", 0),
        next_app_url=job["next_app_url"],
        worker_secret=job["worker_secret"],
        effective_duration=job.get("effective_duration"),
        video_fps=job.get("video_fps"),
    )

    result = {
        "schedule": [[s, e, p] for s, e, p in schedule],
        "blank_png": blank_png,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f)


if __name__ == "__main__":
    main()
