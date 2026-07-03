import openai
import httpx
from config import get_settings
from utils import download_video, extract_audio, cleanup_files, webhook_auth_headers

settings = get_settings()

async def process_transcription(
    video_id: str,
    video_url: str,
    webhook_url: str
):
    """
    Processar transcrição do vídeo

    1. Download do vídeo
    2. Extrair áudio com FFmpeg
    3. Enviar para Whisper API
    4. Formatar resultado em legendas
    5. Notificar Next.js via webhook
    6. Limpar arquivos temporários
    """
    video_path = None
    audio_path = None

    try:
        print(f"[Transcription] Starting for video {video_id}")

        # 1. Download do vídeo
        video_path = await download_video(video_url, video_id)

        # 2. Extrair áudio
        audio_path = extract_audio(video_path)

        # 3. Transcrever com Whisper
        print(f"[Transcription] Sending to Whisper API...")
        client = openai.OpenAI(api_key=settings.openai_api_key)

        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                language="pt",  # Português
                timestamp_granularities=["word", "segment"]
            )

        # 4. Formatar resultado
        # Verificar se segments é lista de dicts ou objetos
        segments = transcription.segments if hasattr(transcription, 'segments') else transcription.get('segments', [])

        # Extrair word-level timestamps (se disponíveis)
        all_words = []
        if hasattr(transcription, 'words') and transcription.words:
            all_words = transcription.words
        elif isinstance(transcription, dict) and transcription.get('words'):
            all_words = transcription['words']

        print(f"[Transcription] Whisper returned {len(segments)} segments, {len(all_words)} words")

        # Acessar como dict ou objeto dependendo do tipo
        subtitles = []
        for i, seg in enumerate(segments, start=1):
            # Tentar acessar como dict primeiro, depois como objeto
            if isinstance(seg, dict):
                seg_start = seg["start"]
                seg_end = seg["end"]
                seg_text = seg["text"].strip()
            else:
                seg_start = seg.start
                seg_end = seg.end
                seg_text = seg.text.strip()

            subtitles.append({
                "id": i,
                "start": seg_start,
                "end": seg_end,
                "text": seg_text
            })

        # Particionar TODAS as words entre os segmentos: cada word vai para o
        # último segmento que começou antes do seu ponto médio. A regra antiga
        # (word contida no intervalo ±0.05s) descartava palavras que cruzavam
        # a fronteira entre dois segmentos — elas sumiam do modo word-group e
        # o highlight pulava direto para a seguinte.
        if subtitles and all_words:
            all_words = sorted(
                all_words,
                key=lambda w: w["start"] if isinstance(w, dict) else w.start,
            )
            words_by_subtitle = [[] for _ in subtitles]
            si = 0
            for w in all_words:
                w_start = w["start"] if isinstance(w, dict) else w.start
                w_end = w["end"] if isinstance(w, dict) else w.end
                w_word = w["word"] if isinstance(w, dict) else w.word
                mid = (w_start + w_end) / 2.0
                while si < len(subtitles) - 1 and mid >= subtitles[si + 1]["start"]:
                    si += 1
                words_by_subtitle[si].append({
                    "word": w_word.strip(),
                    "start": w_start,
                    "end": w_end
                })

            for entry, segment_words in zip(subtitles, words_by_subtitle):
                if segment_words:
                    entry["words"] = segment_words

        print(f"[Transcription] Formatted {len(subtitles)} subtitles")

        # 5. Notificar Next.js
        print(f"[Transcription] Sending webhook to {webhook_url}")
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                webhook_url,
                json={
                    "videoId": video_id,
                    "subtitles": subtitles,
                    "status": "completed"
                },
                headers=webhook_auth_headers(),
                timeout=30.0
            )
            response.raise_for_status()

        print(f"[Transcription] ✓ Success! Video {video_id} completed")

    except Exception as e:
        print(f"[Transcription] ✗ Error processing video {video_id}: {e}")

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
                    headers=webhook_auth_headers(),
                    timeout=30.0
                )
        except Exception as webhook_error:
            print(f"[Transcription] Failed to send error webhook: {webhook_error}")

    finally:
        # 6. Limpar arquivos temporários
        if video_path or audio_path:
            cleanup_files(video_path or "", audio_path or "")
