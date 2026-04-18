import subprocess
import httpx
import os
import sys
import tempfile
import json
import asyncio
from config import get_settings
from utils import (
    download_video,
    generate_srt_file,
    upload_to_storage,
    cleanup_files,
)

settings = get_settings()

# Path to the CLI renderer script and the venv Python interpreter
_WORKER_DIR = os.path.dirname(os.path.abspath(__file__))
_RENDER_CLI = os.path.join(_WORKER_DIR, "render_subtitles_cli.py")
_PYTHON = sys.executable

def get_video_info(video_path: str) -> dict:
    """
    Obter informações do vídeo usando ffprobe

    Returns:
        dict com 'width', 'height', 'duration', etc
    """
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_streams',
                '-show_format',
                '-select_streams', 'v:0',
                video_path
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)
            streams = data.get('streams', [])
            fmt = data.get('format', {})
            duration = float(fmt.get('duration', 0))
            if streams:
                video_stream = streams[0]
                # Parse framerate from r_frame_rate (e.g. "30/1", "30000/1001")
                fps = 30.0
                fps_str = video_stream.get('r_frame_rate', '30/1')
                try:
                    if '/' in fps_str:
                        num, den = fps_str.split('/')
                        fps = float(num) / float(den) if float(den) != 0 else 30.0
                    else:
                        fps = float(fps_str)
                except (ValueError, ZeroDivisionError):
                    fps = 30.0
                return {
                    'width': video_stream.get('width', 1920),
                    'height': video_stream.get('height', 1080),
                    'codec': video_stream.get('codec_name', 'unknown'),
                    'duration': duration,
                    'fps': fps,
                }

        return {'width': 1920, 'height': 1080, 'duration': 0, 'fps': 30.0}

    except Exception as e:
        print(f"[Video Info] Error getting video info: {e}")
        return {'width': 1920, 'height': 1080, 'duration': 0, 'fps': 30.0}


def _get_output_dimensions(format_type: str | None, src_w: int, src_h: int) -> tuple[int, int]:
    """Determine final video dimensions based on format_type."""
    if format_type in ("instagram_story", "tiktok"):
        return 1080, 1920
    elif format_type == "instagram_feed":
        return 1080, 1080
    elif format_type == "youtube":
        return 1920, 1080
    elif format_type == "classic":
        return 1440, 1080
    return src_w, src_h


def _render_subtitle_pngs(
    subtitles: list[dict],
    style: dict,
    video_width: int,
    video_height: int,
    video_id: str,
    trim_start: float = 0,
) -> tuple[list[tuple[float, float, str]], str]:
    """
    Render subtitle PNGs via a separate subprocess (avoids Playwright
    event-loop conflicts with uvicorn on Windows).

    Returns (schedule, blank_png_path).
    """
    input_path = os.path.join(tempfile.gettempdir(), f"subjob_{video_id}.json")
    output_path = os.path.join(tempfile.gettempdir(), f"subresult_{video_id}.json")

    job = {
        "subtitles": subtitles,
        "style": style,
        "video_width": video_width,
        "video_height": video_height,
        "trim_start": trim_start,
    }
    with open(input_path, "w", encoding="utf-8") as f:
        json.dump(job, f)

    try:
        result = subprocess.run(
            [_PYTHON, _RENDER_CLI, input_path, output_path],
            capture_output=True,
            text=True,
            cwd=_WORKER_DIR,
            timeout=300,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Subtitle render subprocess failed (exit {result.returncode}):\n"
                f"{result.stderr}"
            )

        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        schedule = [(s, e, p) for s, e, p in data["schedule"]]
        blank_png = data["blank_png"]
        return schedule, blank_png

    finally:
        for p in (input_path, output_path):
            if os.path.exists(p):
                os.remove(p)


def _build_concat_file(
    schedule: list[tuple[float, float, str]],
    blank_png: str,
    video_duration: float,
    video_id: str,
) -> str:
    """
    Build an FFmpeg concat demuxer file from the subtitle schedule.
    Creates: blank → sub1 → blank → sub2 → ... → blank
    """
    concat_path = os.path.join(tempfile.gettempdir(), f"concat_{video_id}.txt")

    entries: list[tuple[str, float]] = []
    current_time = 0.0

    for start, end, png_path in schedule:
        # Clamp start to current_time to avoid overlapping entries
        effective_start = max(start, current_time)
        gap = effective_start - current_time
        if gap > 0.001:
            entries.append((blank_png, gap))
            current_time += gap
        duration = end - effective_start
        if duration > 0.001:
            entries.append((png_path, duration))
            current_time = end

    # Trailing blank to fill remaining video
    if video_duration > 0 and current_time < video_duration:
        entries.append((blank_png, video_duration - current_time))

    if not entries:
        entries.append((blank_png, max(video_duration, 1.0)))

    with open(concat_path, "w", encoding="utf-8") as f:
        f.write("ffconcat version 1.0\n")
        for path, dur in entries:
            safe = path.replace("\\", "/")
            f.write(f"file '{safe}'\n")
            f.write(f"duration {dur:.6f}\n")
        # Concat demuxer needs a trailing file entry for the last duration
        safe = entries[-1][0].replace("\\", "/")
        f.write(f"file '{safe}'\n")

    return concat_path


async def process_rendering(
    video_id: str,
    video_url: str,
    subtitles: list[dict],
    style: dict,
    format_type: str | None,
    trim: dict | None,
    overlays: list[dict],
    logo_overlay: dict | None,
    webhook_url: str
):
    """
    Renderizar vídeo final com legendas pixel-perfect via Playwright overlay.

    Pipeline:
    1. Download do vídeo
    2. Playwright renderiza cada legenda como PNG transparente (mesmo CSS do editor)
    3. FFmpeg cria vídeo-legenda via concat demuxer
    4. FFmpeg faz overlay do vídeo-legenda no vídeo principal
    5. Upload + webhook
    """
    video_path = None
    output_path = None
    concat_path = None

    try:
        print(f"[Rendering] Starting for video {video_id}")

        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)

        # 2. Obter dimensões e duração do vídeo
        video_info = get_video_info(video_path)
        src_w = video_info.get("width", 1920)
        src_h = video_info.get("height", 1080)
        video_duration = video_info.get("duration", 0)
        video_fps = video_info.get("fps", 30.0)
        print(f"[Rendering] Video: {src_w}x{src_h}, duration={video_duration:.1f}s, fps={video_fps:.2f}")

        # 3. Determinar dimensões finais (formato de saída)
        out_w, out_h = _get_output_dimensions(format_type, src_w, src_h)
        print(f"[Rendering] Output dimensions: {out_w}x{out_h}")

        # 4. Ajustar duração para trim
        trim_start = 0.0
        trim_end = video_duration
        if trim:
            if trim.get("start") is not None:
                trim_start = float(trim["start"])
            if trim.get("end") is not None:
                trim_end = float(trim["end"])
        effective_duration = trim_end - trim_start

        # 5. Renderizar legendas como PNGs via subprocess (separate process)
        print(f"[Rendering] Rendering subtitle PNGs at {out_w}x{out_h}...")
        schedule, blank_png = await asyncio.to_thread(
            _render_subtitle_pngs,
            subtitles, style, out_w, out_h, video_id, trim_start,
        )
        print(f"[Rendering] Generated {len(schedule)} subtitle frames")

        # 6. Criar concat file para o vídeo de legendas
        concat_path = _build_concat_file(
            schedule, blank_png, effective_duration, video_id
        )
        print(f"[Rendering] Concat file: {concat_path}")

        # 7. Construir comando FFmpeg
        output_path = os.path.join(tempfile.gettempdir(), f"rendered_{video_id}.mp4")
        command = ["ffmpeg", "-v", "info"]

        # Input 0: vídeo principal (com trim)
        if trim and trim.get("start") is not None:
            command.extend(["-ss", str(trim["start"])])
        command.extend(["-i", video_path])

        # Input 1: subtitle video via concat demuxer
        command.extend(["-f", "concat", "-safe", "0", "-i", concat_path])

        # Input 2 (optional): logo
        logo_path = None
        if logo_overlay and logo_overlay.get("logoUrl"):
            logo_path = await _download_logo(logo_overlay, video_id)
            if logo_path:
                command.extend(["-i", logo_path])

        # 8. Construir filter_complex
        filter_parts = []

        # Format scaling (if needed)
        if format_type in ("instagram_story", "tiktok"):
            filter_parts.append(
                "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,"
                "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[scaled]"
            )
        elif format_type == "instagram_feed":
            filter_parts.append(
                "[0:v]scale=1080:1080:force_original_aspect_ratio=decrease,"
                "pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black[scaled]"
            )
        elif format_type == "youtube":
            filter_parts.append(
                "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
                "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[scaled]"
            )
        elif format_type == "classic":
            filter_parts.append(
                "[0:v]scale=1440:1080:force_original_aspect_ratio=decrease,"
                "pad=1440:1080:(ow-iw)/2:(oh-ih)/2:black[scaled]"
            )

        # Build the overlay chain
        video_label = "[scaled]" if filter_parts else "[0:v]"

        # Subtitle overlay: normalize to video fps + reset timestamps for sync
        fps_val = round(video_fps, 3)
        filter_parts.append(
            f"[1:v]fps={fps_val},setpts=PTS-STARTPTS,format=rgba[subs]"
        )
        filter_parts.append(
            f"{video_label}[subs]overlay=0:0:format=auto:shortest=1[withsubs]"
        )

        # Logo overlay (optional)
        if logo_path:
            logo_input = "[2:v]"
            logo_cfg = logo_overlay or {}
            pos = logo_cfg.get("position", "top-right")
            size = logo_cfg.get("size", 10)
            opacity = logo_cfg.get("opacity", 0.8)
            padding = 20

            pos_map = {
                "top-left": (str(padding), str(padding)),
                "top-right": (f"W-w-{padding}", str(padding)),
                "bottom-left": (str(padding), f"H-h-{padding}"),
                "bottom-right": (f"W-w-{padding}", f"H-h-{padding}"),
            }
            x_pos, y_pos = pos_map.get(pos, pos_map["top-right"])
            logo_w = f"iw*{size/100}"
            filter_parts.append(
                f"{logo_input}scale={logo_w}:-1,format=rgba,"
                f"colorchannelmixer=aa={opacity}[logo]"
            )
            filter_parts.append(
                f"[withsubs][logo]overlay={x_pos}:{y_pos},format=yuv420p[final]"
            )
            final_label = "[final]"
        else:
            # Force yuv420p for player compatibility (overlay outputs yuva420p)
            filter_parts.append("[withsubs]format=yuv420p[out]")
            final_label = "[out]"

        complex_filter = "; ".join(filter_parts)
        command.extend(["-filter_complex", complex_filter])
        command.extend(["-map", final_label])
        command.extend(["-map", "0:a?"])

        # Trim duration as output option (if trimmed, limit output to trimmed duration)
        if trim and trim.get("end") is not None:
            trim_duration = effective_duration
            command.extend(["-t", f"{trim_duration:.6f}"])

        # Codec e qualidade
        command.extend([
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-y",
            output_path,
        ])

        print(f"[Rendering] FFmpeg command: {' '.join(command)}")

        # 9. Executar FFmpeg
        result = subprocess.run(
            command, check=True, capture_output=True, text=True
        )

        if result.stderr:
            # Show any warnings/errors from FFmpeg
            err_lines = [
                l for l in result.stderr.splitlines()
                if any(k in l.lower() for k in ["error", "warning", "overlay", "concat"])
            ]
            if err_lines:
                for line in err_lines[:10]:
                    print(f"  {line}")

        print(f"[Rendering] Video rendered: {output_path}")
        print(f"[Rendering] Output size: {os.path.getsize(output_path)} bytes")

        # 10. URL para download direto do worker
        worker_base_url = "http://localhost:8000"
        output_url = f"{worker_base_url}/download/{video_id}"
        print(f"[Rendering] Download URL: {output_url}")

        # 11. Notificar Next.js via webhook
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                webhook_url,
                json={
                    "videoId": video_id,
                    "outputUrl": output_url,
                    "outputPath": output_path,
                    "status": "completed",
                },
                timeout=30.0,
            )
            response.raise_for_status()

        print(f"[Rendering] ✓ Success! Video {video_id} completed")

        # Cleanup (keep output_path for download)
        cleanup_files(video_path or "", concat_path or "")

    except subprocess.CalledProcessError as e:
        print(f"[Rendering] ✗ FFmpeg error for video {video_id}:")
        print(f"[Rendering] stdout: {e.stdout}")
        print(f"[Rendering] stderr: {e.stderr}")
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    webhook_url,
                    json={
                        "videoId": video_id,
                        "error": f"FFmpeg error: {e.stderr[:500]}",
                        "status": "failed",
                    },
                    timeout=30.0,
                )
        except Exception as we:
            print(f"[Rendering] Failed to send error webhook: {we}")

    except Exception as e:
        print(f"[Rendering] ✗ Error processing video {video_id}: {e}")
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    webhook_url,
                    json={"videoId": video_id, "error": str(e), "status": "failed"},
                    timeout=30.0,
                )
        except Exception as we:
            print(f"[Rendering] Failed to send error webhook: {we}")

    finally:
        cleanup_files(video_path or "", concat_path or "")


async def _download_logo(logo_overlay: dict, video_id: str) -> str | None:
    """Download logo image and return local path, or None on failure."""
    try:
        logo_url = logo_overlay["logoUrl"]
        if logo_url.startswith("/"):
            logo_url = f"http://localhost:3000{logo_url}"
        path = await download_video(logo_url, f"logo_{video_id}")
        if path and os.path.exists(path):
            return path
    except Exception as e:
        print(f"[Rendering] Warning: Failed to download logo: {e}")
    return None
