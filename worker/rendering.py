import subprocess
import httpx
import os
import tempfile
from config import get_settings
from utils import (
    download_video,
    generate_srt_file,
    upload_to_storage,
    cleanup_files
)

settings = get_settings()

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
                '-select_streams', 'v:0',
                video_path
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            streams = data.get('streams', [])
            if streams:
                video_stream = streams[0]
                return {
                    'width': video_stream.get('width', 1920),
                    'height': video_stream.get('height', 1080),
                    'codec': video_stream.get('codec_name', 'unknown')
                }

        return {'width': 1920, 'height': 1080}

    except Exception as e:
        print(f"[Video Info] Error getting video info: {e}")
        return {'width': 1920, 'height': 1080}

def hex_to_ffmpeg_color(hex_color: str, opacity: float = 1.0) -> str:
    """Converter cor hex para formato FFmpeg ASS (&HAABBGGRR)"""
    hex_color = hex_color.lstrip('#')

    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)

    # ASS Alpha: 00 = opaque, FF = transparent
    # Invertemos a opacidade para transparência
    a = int((1 - opacity) * 255)

    # Formato FFmpeg: &HAABBGGRR (BGR, não RGB)
    return f"&H{a:02X}{b:02X}{g:02X}{r:02X}"

def build_subtitle_style(style: dict, video_width: int) -> str:
    """
    Construir força_style string para FFmpeg ASS

    Args:
        style: Dicionário de estilo
        video_width: Largura do vídeo em pixels
    """
    primary_color = hex_to_ffmpeg_color(style.get("color", "#FFFFFF"), 1)
    outline_color = hex_to_ffmpeg_color(style.get("outlineColor", "#000000"), 1)

    background_opacity = style.get("backgroundOpacity", 0.8)
    back_color = hex_to_ffmpeg_color(
        style.get("backgroundColor", "#000000"),
        background_opacity
    )

    font_name = style.get("fontFamily", "Arial")
    font_size = style.get("fontSize", 24)
    outline_width = style.get("outlineWidth", 2)

    # Calcular margens laterais (5% de cada lado)
    margin_percent = 0.05
    margin_horizontal = int(video_width * margin_percent)

    # BorderStyle: 1 = outline apenas, 3 = opaque box (fundo)
    border_style = 3 if background_opacity > 0 else 1

    # No modo BorderStyle=3, OutlineColour é usado para a cor de fundo
    if border_style == 3:
        force_style = (
            f"FontName={font_name},"
            f"FontSize={font_size},"
            f"PrimaryColour={primary_color},"
            f"OutlineColour={back_color},"
            f"BackColour={outline_color},"
            f"BorderStyle={border_style},"
            f"Outline={outline_width},"
            f"MarginL={margin_horizontal},"
            f"MarginR={margin_horizontal}"
        )
    else:
        force_style = (
            f"FontName={font_name},"
            f"FontSize={font_size},"
            f"PrimaryColour={primary_color},"
            f"OutlineColour={outline_color},"
            f"BackColour={back_color},"
            f"BorderStyle={border_style},"
            f"Outline={outline_width},"
            f"MarginL={margin_horizontal},"
            f"MarginR={margin_horizontal}"
        )

    return force_style

async def process_rendering(
    video_id: str,
    video_url: str,
    subtitles: list[dict],
    style: dict,
    format_type: str | None,
    trim: dict | None,
    overlays: list[dict],
    webhook_url: str
):
    """
    Processar renderização do vídeo final

    1. Download do vídeo
    2. Gerar arquivo SRT
    3. Construir comando FFmpeg
    4. Renderizar vídeo com legendas hardcoded
    5. Upload do resultado
    6. Notificar Next.js via webhook
    7. Limpar arquivos temporários
    """
    video_path = None
    srt_path = None
    output_path = None

    try:
        print(f"[Rendering] Starting for video {video_id}")

        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)

        # 2. Obter dimensões do vídeo
        video_info = get_video_info(video_path)
        video_width = video_info.get('width', 1920)  # Fallback para Full HD
        print(f"[Rendering] Video dimensions: {video_info.get('width')}x{video_info.get('height')}")

        # 3. Gerar arquivo SRT
        srt_path = generate_srt_file(subtitles, video_id)

        # 4. Path do vídeo final
        output_path = os.path.join(tempfile.gettempdir(), f"rendered_{video_id}.mp4")

        # 5. Construir filtros FFmpeg
        filters = []

        # Formatos para redes sociais
        if format_type == "instagram_story" or format_type == "tiktok":
            filters.append(
                "scale=1080:1920:force_original_aspect_ratio=decrease,"
                "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"
            )
        elif format_type == "instagram_feed":
            filters.append(
                "scale=1080:1080:force_original_aspect_ratio=decrease,"
                "pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black"
            )
        elif format_type == "youtube":
            filters.append(
                "scale=1920:1080:force_original_aspect_ratio=decrease,"
                "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black"
            )

        # Aplicar legendas com estilo (com margens baseadas na largura do vídeo)
        subtitle_style = build_subtitle_style(style, video_width)

        # Escape do caminho do SRT para FFmpeg
        # No Windows, precisamos escapar as barras invertidas
        # No Linux, precisamos escapar os dois pontos
        import platform
        if platform.system() == "Windows":
            # Windows: escapar barras invertidas (duplicar)
            srt_escaped = srt_path.replace('\\', '\\\\\\\\').replace(':', '\\\\:')
        else:
            # Linux: escapar dois pontos
            srt_escaped = srt_path.replace(':', '\\:')

        subtitle_filter = f"subtitles={srt_escaped}:force_style='{subtitle_style}'"
        filters.append(subtitle_filter)

        # Combinar filtros
        video_filter = ",".join(filters) if filters else None

        # 5. Construir comando FFmpeg
        command = ["ffmpeg"]

        # Trim (se especificado)
        if trim and trim.get("start") is not None:
            command.extend(["-ss", str(trim["start"])])

        command.extend(["-i", video_path])

        if trim and trim.get("end") is not None:
            command.extend(["-to", str(trim["end"])])

        # Filtros de vídeo
        if video_filter:
            command.extend(["-vf", video_filter])

        # Codec e qualidade
        command.extend([
            "-c:v", "libx264",
            "-preset", "medium",  # medium = boa qualidade/velocidade
            "-crf", "23",         # 23 = boa qualidade (0-51, menor = melhor)
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",  # Otimizar para streaming
            "-y",  # Overwrite output
            output_path
        ])

        print(f"[Rendering] FFmpeg command: {' '.join(command)}")

        # 6. Executar FFmpeg
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True
        )

        print(f"[Rendering] Video rendered successfully: {output_path}")
        print(f"[Rendering] Output file size: {os.path.getsize(output_path)} bytes")

        # 7. Por enquanto, não vamos fazer upload - o arquivo fica no worker
        # IMPORTANTE: Em produção, implemente upload para S3/R2
        # output_url = await upload_to_storage(output_path, video_id)

        # Salvar caminho do arquivo para servir depois
        print(f"[Rendering] Video rendered at: {output_path}")

        # URL para download direto do worker
        from config import get_settings
        settings = get_settings()
        worker_base_url = "http://localhost:8000"  # Em produção, use a URL real do worker
        output_url = f"{worker_base_url}/download/{video_id}"

        print(f"[Rendering] Download URL: {output_url}")

        # 8. Notificar Next.js com o caminho do arquivo
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                webhook_url,
                json={
                    "videoId": video_id,
                    "outputUrl": output_url,
                    "outputPath": output_path,  # Caminho local no worker
                    "status": "completed"
                },
                timeout=30.0
            )
            response.raise_for_status()

        print(f"[Rendering] ✓ Success! Video {video_id} completed")

        # NÃO deletar o arquivo ainda - ele será servido depois
        cleanup_files(video_path or "", srt_path or "")
        # output_path não é deletado!

    except subprocess.CalledProcessError as e:
        print(f"[Rendering] ✗ FFmpeg error for video {video_id}:")
        print(f"[Rendering] stdout: {e.stdout}")
        print(f"[Rendering] stderr: {e.stderr}")

        # Notificar erro ao Next.js
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    webhook_url,
                    json={
                        "videoId": video_id,
                        "error": f"FFmpeg error: {e.stderr}",
                        "status": "failed"
                    },
                    timeout=30.0
                )
        except Exception as webhook_error:
            print(f"[Rendering] Failed to send error webhook: {webhook_error}")

    except Exception as e:
        print(f"[Rendering] ✗ Error processing video {video_id}: {e}")

        # Notificar erro ao Next.js
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    webhook_url,
                    json={
                        "videoId": video_id,
                        "error": str(e),
                        "status": "failed"
                    },
                    timeout=30.0
                )
        except Exception as webhook_error:
            print(f"[Rendering] Failed to send error webhook: {webhook_error}")

    finally:
        # 9. Limpar arquivos temporários (exceto output_path que será servido depois)
        cleanup_files(
            video_path or "",
            srt_path or ""
        )
        # NOTA: output_path NÃO é deletado aqui - ele fica disponível para download
