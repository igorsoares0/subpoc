"""
CLI entry point for subtitle PNG rendering.

Runs in a separate subprocess to avoid Playwright's event loop conflicting
with uvicorn's asyncio loop on Windows. Takes a JSON job file, renders all
subtitle PNGs, and writes a JSON result file.
"""

import sys
import json
from subtitle_renderer import SubtitleRenderer


def main():
    if len(sys.argv) != 3:
        print("Usage: render_subtitles_cli.py <input.json> <output.json>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        job = json.load(f)

    subtitles = job["subtitles"]
    style = job["style"]
    video_width = job["video_width"]
    video_height = job["video_height"]
    trim_start = job.get("trim_start", 0)

    renderer = SubtitleRenderer()
    try:
        schedule = _build_schedule(
            subtitles, style, video_width, video_height, renderer, trim_start
        )
        blank_png = renderer.render_blank_frame(video_width, video_height)
    finally:
        renderer.close()

    result = {
        "schedule": [[s, e, p] for s, e, p in schedule],
        "blank_png": blank_png,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f)


def _build_schedule(
    subtitles: list[dict],
    style: dict,
    video_width: int,
    video_height: int,
    renderer: SubtitleRenderer,
    trim_start: float,
) -> list[tuple[float, float, str]]:
    position = None
    if style and isinstance(style.get("position"), dict):
        position = style["position"]

    display_mode = style.get("displayMode", "sentence") if style else "sentence"
    schedule: list[tuple[float, float, str]] = []

    if display_mode == "word-group":
        words_per_group = style.get("wordsPerGroup", 3) if style else 3
        all_words: list[dict] = []
        for sub in subtitles:
            for w in sub.get("words", []):
                all_words.append(w)

        groups: list[list[dict]] = []
        for i in range(0, len(all_words), words_per_group):
            groups.append(all_words[i : i + words_per_group])

        for group in groups:
            for active_idx, word in enumerate(group):
                start = word.get("start", 0) - trim_start
                end = word.get("end", 0) - trim_start
                if end <= 0 or start < 0:
                    continue
                start = max(0, start)
                png_path = renderer.render_wordgroup(
                    group, active_idx, style, video_width, video_height, position
                )
                schedule.append((start, end, png_path))
    else:
        for sub in subtitles:
            text = sub.get("text", "")
            if not text.strip():
                continue
            start = sub.get("start", 0) - trim_start
            end = sub.get("end", 0) - trim_start
            if end <= 0:
                continue
            start = max(0, start)
            png_path = renderer.render_sentence(
                text, style, video_width, video_height, position
            )
            schedule.append((start, end, png_path))

    schedule.sort(key=lambda x: x[0])
    return schedule


if __name__ == "__main__":
    main()
