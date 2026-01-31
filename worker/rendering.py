import subprocess
import httpx
import os
import tempfile
from config import get_settings
from utils import (
    download_video,
    generate_srt_file,
    generate_ass_file,
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
    has_outline = style.get("outline", False)
    outline_width = style.get("outlineWidth", 2) if has_outline else 0

    # Calcular margens laterais (5% de cada lado)
    margin_percent = 0.05
    margin_horizontal = int(video_width * margin_percent)

    # BorderStyle: 1 = outline apenas, 3 = opaque box (fundo)
    # When background is visible, use BorderStyle=3 (opaque box)
    # When no background, use BorderStyle=1 (outline only)
    border_style = 3 if background_opacity > 0 else 1

    if border_style == 3:
        # In BorderStyle=3, Outline controls box padding — need minimum for visible box
        outline_width = max(outline_width, 5)

        # BorderStyle=3: OutlineColour becomes the box color, Outline controls box padding
        # Text outline is not separately available in this mode
        force_style = (
            f"FontName={font_name},"
            f"FontSize={font_size},"
            f"Bold=-1,"
            f"PrimaryColour={primary_color},"
            f"OutlineColour={back_color},"
            f"BackColour={back_color},"
            f"BorderStyle={border_style},"
            f"Outline={outline_width},"
            f"MarginL={margin_horizontal},"
            f"MarginR={margin_horizontal}"
        )
    else:
        # BorderStyle=1: OutlineColour is the text outline color
        force_style = (
            f"FontName={font_name},"
            f"FontSize={font_size},"
            f"Bold=-1,"
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
    logo_overlay: dict | None,
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
    ass_path = None
    output_path = None

    try:
        print(f"[Rendering] Starting for video {video_id}")

        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)

        # 2. Obter dimensões do vídeo
        video_info = get_video_info(video_path)
        video_width = video_info.get('width', 1920)  # Fallback para Full HD
        video_height = video_info.get('height', 1080)
        print(f"[Rendering] Video dimensions: {video_width}x{video_height}")

        # 3. Extrair posição das legendas do estilo
        subtitle_position = None
        if style and isinstance(style.get("position"), dict):
            subtitle_position = style["position"]

        # 4. Gerar arquivo ASS com posicionamento personalizado
        ass_path = generate_ass_file(
            subtitles,
            video_id,
            position=subtitle_position,
            video_width=video_width,
            video_height=video_height,
            style=style
        )

        # 5. Path do vídeo final
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
        elif format_type == "classic":
            filters.append(
                "scale=1440:1080:force_original_aspect_ratio=decrease,"
                "pad=1440:1080:(ow-iw)/2:(oh-ih)/2:black"
            )

        # Escape do caminho do ASS para FFmpeg
        # No Windows, precisamos escapar as barras invertidas
        # No Linux, precisamos escapar os dois pontos
        import platform
        if platform.system() == "Windows":
            # Windows: escapar barras invertidas (duplicar)
            ass_escaped = ass_path.replace('\\', '\\\\\\\\').replace(':', '\\\\:')
        else:
            # Linux: escapar dois pontos
            ass_escaped = ass_path.replace(':', '\\:')

        # Word-group mode: style is fully baked into the ASS file (inline \c tags, etc.)
        # Sentence mode: use force_style to override ASS defaults
        display_mode = style.get('displayMode', 'sentence') if style else 'sentence'
        if display_mode == 'word-group':
            subtitle_filter = f"subtitles={ass_escaped}"
        else:
            subtitle_style = build_subtitle_style(style, video_width)
            subtitle_filter = f"subtitles={ass_escaped}:force_style='{subtitle_style}'"
        filters.append(subtitle_filter)

        # Combinar filtros base (sem logo ainda)
        video_filter = ",".join(filters) if filters else None

        # Logo overlay (será aplicado como input separado)
        logo_path = None
        logo_filter_complex = None
        if logo_overlay and logo_overlay.get("logoUrl"):
            logo_url = logo_overlay["logoUrl"]
            position = logo_overlay.get("position", "top-right")
            size = logo_overlay.get("size", 10)  # percentage
            opacity = logo_overlay.get("opacity", 0.8)

            # Download logo
            try:
                # Converter URL relativa para URL completa
                if logo_url.startswith("/"):
                    # Em produção, você precisará da URL base do Next.js
                    app_url = "http://localhost:3000"
                    logo_url = f"{app_url}{logo_url}"

                # Download logo temporário
                logo_temp_path = await download_video(logo_url, f"logo_{video_id}")
                if logo_temp_path and os.path.exists(logo_temp_path):
                    logo_path = logo_temp_path

                    # Calcular posição
                    padding = 20
                    if position == "top-left":
                        x_pos = str(padding)
                        y_pos = str(padding)
                    elif position == "top-right":
                        x_pos = f"W-w-{padding}"
                        y_pos = str(padding)
                    elif position == "bottom-left":
                        x_pos = str(padding)
                        y_pos = f"H-h-{padding}"
                    else:  # bottom-right
                        x_pos = f"W-w-{padding}"
                        y_pos = f"H-h-{padding}"

                    # Filter complex para logo overlay
                    # [0:v] = vídeo principal, [1:v] = logo
                    # Aplicar escala e opacidade ao logo, depois overlay
                    logo_width = f"iw*{size/100}"
                    logo_filter_complex = f"[1:v]scale={logo_width}:-1,format=rgba,colorchannelmixer=aa={opacity}[logo];[0:v][logo]overlay={x_pos}:{y_pos}"

                    print(f"[Rendering] Logo overlay will be applied from: {logo_path}")
                    print(f"[Rendering] Logo filter complex: {logo_filter_complex}")

            except Exception as e:
                print(f"[Rendering] Warning: Failed to download/process logo: {e}")
                logo_path = None

        # 5. Construir comando FFmpeg
        command = ["ffmpeg"]

        # Trim (se especificado)
        if trim and trim.get("start") is not None:
            command.extend(["-ss", str(trim["start"])])

        command.extend(["-i", video_path])

        # Adicionar logo como segundo input (se existe)
        if logo_path and os.path.exists(logo_path):
            command.extend(["-i", logo_path])

        if trim and trim.get("end") is not None:
            command.extend(["-to", str(trim["end"])])

        # Filtros de vídeo
        # Se temos logo, precisamos usar -filter_complex para combinar
        if logo_path and logo_filter_complex:
            # Aplicar filtros base primeiro no vídeo, depois overlay com logo
            if video_filter:
                # Aplicar filtros base ao vídeo [0:v], depois logo overlay
                complex_filter = f"[0:v]{video_filter}[base];{logo_filter_complex.replace('[0:v]', '[base]')}"
            else:
                # Apenas logo overlay
                complex_filter = logo_filter_complex
            command.extend(["-filter_complex", complex_filter])
        elif video_filter:
            # Apenas filtros base (sem logo)
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
        cleanup_files(video_path or "", ass_path or "")
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
            ass_path or ""
        )
        # NOTA: output_path NÃO é deletado aqui - ele fica disponível para download
