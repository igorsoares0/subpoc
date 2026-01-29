import httpx
import subprocess
import os
import tempfile
import shutil
from datetime import timedelta
from pathlib import Path
import boto3
from botocore.exceptions import ClientError
from config import get_settings

async def download_video(url: str, video_id: str) -> str:
    """
    Download vídeo do URL ou copia de caminho local.

    Aceita tanto URLs completas (http://...) quanto caminhos relativos (/uploads/...).
    Para caminhos relativos, assume que o arquivo está em C:\\allsaas\\subs\\public\\
    """
    temp_dir = tempfile.gettempdir()
    video_path = os.path.join(temp_dir, f"video_{video_id}.mp4")

    print(f"[Download] Downloading video from {url} to {video_path}")

    # Verificar se é URL HTTP/HTTPS ou caminho local
    if url.startswith('http://') or url.startswith('https://'):
        # Download via HTTP
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.get(url)
            response.raise_for_status()

            with open(video_path, "wb") as f:
                f.write(response.content)
    else:
        # Caminho local relativo - copiar arquivo
        # Assumir que caminhos como /uploads/videos/... estão em C:\allsaas\subs\public\
        local_path = url.lstrip('/')  # Remove barra inicial
        full_path = os.path.join('C:\\allsaas\\subs\\public', local_path)

        print(f"[Download] Local file detected: {full_path}")

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Video file not found: {full_path}")

        # Copiar arquivo para temp
        shutil.copy(full_path, video_path)
        print(f"[Download] Copied local file to temp")

    print(f"[Download] Video ready: {os.path.getsize(video_path)} bytes")
    return video_path

def extract_audio(video_path: str) -> str:
    """Extrair áudio do vídeo usando FFmpeg"""
    audio_path = video_path.replace(".mp4", ".mp3")

    print(f"[Audio] Extracting audio from {video_path} to {audio_path}")

    command = [
        "ffmpeg",
        "-i", video_path,
        "-vn",                # Sem vídeo
        "-ar", "16000",       # Sample rate 16kHz (ótimo para Whisper)
        "-ac", "1",           # Mono
        "-b:a", "64k",        # Bitrate 64k
        "-f", "mp3",
        "-y",                 # Overwrite output
        audio_path
    ]

    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True
    )

    print(f"[Audio] Audio extracted successfully: {os.path.getsize(audio_path)} bytes")
    return audio_path

def generate_srt_file(subtitles: list[dict], video_id: str) -> str:
    """Gerar arquivo SRT a partir de legendas"""
    temp_dir = tempfile.gettempdir()
    srt_path = os.path.join(temp_dir, f"subtitles_{video_id}.srt")

    srt_content = []
    for i, sub in enumerate(subtitles, start=1):
        start_time = format_timestamp(sub["start"])
        end_time = format_timestamp(sub["end"])

        srt_content.append(f"{i}")
        srt_content.append(f"{start_time} --> {end_time}")
        srt_content.append(sub["text"])
        srt_content.append("")  # Linha em branco

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_content))

    print(f"[SRT] SRT file generated: {srt_path} ({len(subtitles)} subtitles)")
    return srt_path

def format_timestamp(seconds: float) -> str:
    """Converter segundos para formato SRT (HH:MM:SS,mmm)"""
    td = timedelta(seconds=seconds)
    hours = td.seconds // 3600
    minutes = (td.seconds % 3600) // 60
    secs = td.seconds % 60
    millis = td.microseconds // 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def _hex_to_ass_color(hex_color: str, opacity: float = 1.0) -> str:
    """Converter cor hex para formato ASS (&HAABBGGRR)"""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    a = int((1 - opacity) * 255)
    return f"&H{a:02X}{b:02X}{g:02X}{r:02X}"

def generate_ass_file(
    subtitles: list[dict],
    video_id: str,
    position: dict | None = None,
    video_width: int = 1920,
    video_height: int = 1080,
    style: dict | None = None
) -> str:
    """
    Gerar arquivo ASS com posicionamento personalizado de legendas

    Args:
        subtitles: Lista de dicionários com legendas
        video_id: Identificador do vídeo
        position: Dicionário com coordenadas 'x' e 'y' em porcentagem (0-100)
        video_width: Largura do vídeo em pixels
        video_height: Altura do vídeo em pixels
        style: Dicionário de estilo (para word-group/karaoke mode)

    Returns:
        Caminho do arquivo ASS gerado
    """
    temp_dir = tempfile.gettempdir()
    ass_path = os.path.join(temp_dir, f"subtitles_{video_id}.ass")

    # Calcular posição em pixels a partir de porcentagem
    if position and isinstance(position, dict):
        x_percent = position.get('x', 50)
        y_percent = position.get('y', 90)
    else:
        # Posição padrão: centro horizontal, próximo ao fundo
        x_percent = 50
        y_percent = 90

    x_pixels = int((x_percent / 100) * video_width)
    y_pixels = int((y_percent / 100) * video_height)

    display_mode = (style or {}).get('displayMode', 'sentence')
    words_per_group = (style or {}).get('wordsPerGroup', 3)
    uppercase = (style or {}).get('uppercase', False)
    highlight_color = (style or {}).get('highlightColor', '#FFD700')

    # Cabeçalho ASS
    ass_content = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {video_width}",
        f"PlayResY: {video_height}",
        "WrapStyle: 0",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ]

    # Check if word-group mode with word data available
    has_word_data = any(sub.get('words') for sub in subtitles)

    if display_mode == 'word-group' and has_word_data:
        # Flatten all words
        all_words = []
        for sub in subtitles:
            if sub.get('words'):
                all_words.extend(sub['words'])

        # ASS color tags for highlight
        highlight_ass = _hex_to_ass_color(highlight_color)
        base_color_hex = (style or {}).get('color', '#FFFFFF')
        base_ass = _hex_to_ass_color(base_color_hex)

        # Group words into chunks
        for i in range(0, len(all_words), words_per_group):
            group = all_words[i:i + words_per_group]
            group_start = group[0]['start']
            group_end = group[-1]['end']

            # For each word in the group, create a separate dialogue line
            # where that word is highlighted (shown for its duration)
            for j, w in enumerate(group):
                word_start = w['start']
                word_end = w['end']

                start_time = format_ass_timestamp(word_start)
                end_time = format_ass_timestamp(word_end)

                # Build text with all words, highlighting the active one
                parts = []
                for k, gw in enumerate(group):
                    word_text = gw['word'].upper() if uppercase else gw['word']
                    if k == j:
                        parts.append(f"{{\\c{highlight_ass}}}{word_text}{{\\c{base_ass}}}")
                    else:
                        parts.append(word_text)

                line_text = " ".join(parts)
                text = f"{{\\pos({x_pixels},{y_pixels})}}{line_text}"
                dialogue = f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}"
                ass_content.append(dialogue)

        print(f"[ASS] Word-group ASS gerado: {ass_path} ({len(all_words)} words, groups of {words_per_group})")
    else:
        # Standard sentence mode
        for sub in subtitles:
            start_time = format_ass_timestamp(sub["start"])
            end_time = format_ass_timestamp(sub["end"])

            sub_text = sub['text'].upper() if uppercase else sub['text']
            text = f"{{\\pos({x_pixels},{y_pixels})}}{sub_text}"

            dialogue = f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}"
            ass_content.append(dialogue)

        print(f"[ASS] Arquivo ASS gerado: {ass_path} ({len(subtitles)} legendas, pos: {x_pixels},{y_pixels})")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write("\n".join(ass_content))

    return ass_path

def format_ass_timestamp(seconds: float) -> str:
    """
    Converter segundos para formato ASS (H:MM:SS.CC)
    ASS usa centésimos de segundo (não milissegundos)
    """
    td = timedelta(seconds=seconds)
    hours = td.seconds // 3600
    minutes = (td.seconds % 3600) // 60
    secs = td.seconds % 60
    centiseconds = td.microseconds // 10000  # Converter microsegundos para centésimos

    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"

async def upload_to_storage(file_path: str, video_id: str) -> str:
    """
    Upload arquivo para storage (S3/R2/etc)

    Para MVP, retorna URL placeholder.
    Descomente o código abaixo para implementar upload real.
    """
    filename = f"{video_id}_rendered.mp4"

    # TODO: Implementar upload para seu storage (S3, R2, etc)
    # Exemplo com S3/R2 (descomentar quando configurar):
    """
    import boto3
    from config import get_settings

    settings = get_settings()

    s3_client = boto3.client(
        's3',
        endpoint_url=f'https://{settings.r2_account_id}.r2.cloudflarestorage.com',
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name='auto'
    )

    with open(file_path, 'rb') as f:
        s3_client.upload_fileobj(
            f,
            settings.r2_bucket_name,
            filename,
            ExtraArgs={'ContentType': 'video/mp4'}
        )

    return f"https://your-cdn-url.com/{filename}"
    """

    # Por enquanto, retorna URL placeholder
    print(f"[Upload] File ready for upload: {file_path}")
    print(f"[Upload] WARNING: Upload não implementado, retornando URL placeholder")
    return f"https://cdn.example.com/videos/{filename}"

def cleanup_files(*file_paths: str):
    """Deletar arquivos temporários"""
    for file_path in file_paths:
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                print(f"[Cleanup] Removed: {file_path}")
        except Exception as e:
            print(f"[Cleanup] Error removing {file_path}: {e}")


async def upload_to_r2(file_path: str, r2_key: str) -> str:
    """
    Upload de arquivo para Cloudflare R2.

    Args:
        file_path: Caminho local do arquivo
        r2_key: Chave no R2 (ex: "thumbnails/video123/frame_5.0.jpg")

    Returns:
        URL pública do arquivo
    """
    settings = get_settings()

    # Verificar se R2 está configurado
    if not all([
        settings.r2_account_id,
        settings.r2_access_key_id,
        settings.r2_secret_access_key,
        settings.r2_bucket_name
    ]):
        # Se R2 não está configurado, retorna URL placeholder
        print(f"[R2] WARNING: R2 not configured, returning placeholder URL")
        return f"https://placeholder.r2.dev/{r2_key}"

    try:
        # Configurar cliente S3 para R2
        s3_client = boto3.client(
            's3',
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name='auto'
        )

        # Upload para R2
        with open(file_path, 'rb') as f:
            s3_client.upload_fileobj(
                f,
                settings.r2_bucket_name,
                r2_key,
                ExtraArgs={
                    'ContentType': 'image/jpeg',
                    'CacheControl': 'public, max-age=31536000',  # Cache 1 ano
                }
            )

        # Retornar URL pública
        r2_public_url = settings.r2_public_url or f"https://{settings.r2_bucket_name}.r2.dev"
        public_url = f"{r2_public_url}/{r2_key}"

        print(f"[R2] Uploaded: {file_path} -> {public_url}")
        return public_url

    except ClientError as e:
        print(f"[R2] Upload error: {e}")
        raise Exception(f"Failed to upload to R2: {e}")
