"""
Refino dos timestamps de palavra do whisper-1 usando o próprio áudio.

O whisper-1 interpola os timestamps de palavra a partir do decoder, sem
alinhar com o sinal — eles derivam centenas de ms. Erros típicos:
  - a primeira palavra após um silêncio "começa" dentro do silêncio
    (o highlight acende antes da fala);
  - a palavra "termina" dentro da pausa seguinte (a pausa real some e o
    auto-split do word-group não quebra o grupo nela);
  - várias palavras seguidas com duração ~0 (o highlight teleporta).

Aqui fazemos uma versão barata de forced alignment: um VAD por energia (RMS
em janelas de 10 ms) e "snap" das bordas das palavras para onde há voz de
fato. Nunca inventa palavras nem muda a ordem — só ajusta start/end.
Qualquer falha devolve os words originais (fail-safe).
"""

import subprocess

import numpy as np

SAMPLE_RATE = 16000
FRAME_SEC = 0.01  # janela do VAD

# VAD: um frame tem voz quando sua energia (dB) passa de
# max(piso_de_ruído + NOISE_MARGIN_DB, pico - PEAK_RANGE_DB).
NOISE_FLOOR_PERCENTILE = 15
NOISE_MARGIN_DB = 9.0
PEAK_PERCENTILE = 99
PEAK_RANGE_DB = 45.0
SMOOTH_FRAMES = 5  # median (voto de maioria) para não picotar o VAD

# Se o VAD marca quase nada ou quase tudo como voz (ex.: música de fundo
# alta), ele não é confiável — pula o snap.
MIN_VOICED_FRACTION = 0.05
MAX_VOICED_FRACTION = 0.97

# Snap do start para frente: busca voz por até MAX_START_SHIFT s. Recua
# ONSET_PAD s a partir do onset detectado, porque consoantes surdas
# (s, f, ch) têm pouca energia e o VAD as perde.
MAX_START_SHIFT = 0.4
ONSET_PAD = 0.03
# Snap do end para trás: nunca encurta a palavra para menos que MIN_END_KEEP,
# e soma OFFSET_PAD após o último frame com voz (mesmo motivo do ONSET_PAD).
MIN_END_KEEP = 0.08
OFFSET_PAD = 0.05

# Palavras seguidas com duração < CLUSTER_MAX_DURATION formam um cluster que
# é redistribuído no tempo disponível, proporcional ao nº de caracteres.
CLUSTER_MAX_DURATION = 0.05

# Mesmo valor de MIN_WORD_DURATION em lib/subtitle-track/normalize.ts.
MIN_WORD_DURATION = 0.06


def load_pcm(audio_path: str) -> np.ndarray:
    """Decodifica o áudio para PCM mono 16 kHz float32 em [-1, 1]."""
    result = subprocess.run(
        [
            "ffmpeg", "-v", "error",
            "-i", audio_path,
            "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE),
            "-",
        ],
        check=True,
        capture_output=True,
    )
    return np.frombuffer(result.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def voiced_frames(pcm: np.ndarray) -> np.ndarray:
    """Máscara booleana de voz, um valor por janela de FRAME_SEC."""
    hop = int(SAMPLE_RATE * FRAME_SEC)
    n = len(pcm) // hop
    if n == 0:
        return np.zeros(0, dtype=bool)

    frames = pcm[: n * hop].reshape(n, hop)
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
    db = 20.0 * np.log10(rms)

    floor = np.percentile(db, NOISE_FLOOR_PERCENTILE)
    peak = np.percentile(db, PEAK_PERCENTILE)
    threshold = max(floor + NOISE_MARGIN_DB, peak - PEAK_RANGE_DB)
    voiced = (db > threshold).astype(np.int32)

    half = SMOOTH_FRAMES // 2
    padded = np.pad(voiced, half, mode="edge")
    counts = np.convolve(padded, np.ones(SMOOTH_FRAMES, dtype=np.int32), mode="valid")
    return counts > half


def _frame(t: float) -> int:
    return int(t / FRAME_SEC)


def _voiced_at(voiced: np.ndarray, t: float) -> bool:
    i = _frame(t)
    return 0 <= i < len(voiced) and bool(voiced[i])


def _spread_clusters(words: list[dict]) -> int:
    """
    Redistribui runs (>= 2) de palavras com duração ~0 pelo intervalo do run
    (até o start da próxima palavra), proporcional ao nº de caracteres.
    Retorna quantas palavras foram ajustadas.
    """
    fixed = 0
    n = len(words)
    i = 0
    while i < n:
        if words[i]["end"] - words[i]["start"] >= CLUSTER_MAX_DURATION:
            i += 1
            continue
        j = i
        while j + 1 < n and words[j + 1]["end"] - words[j + 1]["start"] < CLUSTER_MAX_DURATION:
            j += 1
        if j > i:
            run = words[i : j + 1]
            span_start = run[0]["start"]
            span_end = max(run[-1]["end"], words[j + 1]["start"] if j + 1 < n else run[-1]["end"])
            if span_end - span_start >= MIN_WORD_DURATION * len(run):
                weights = [max(len(w["word"]), 1) for w in run]
                total = sum(weights)
                cursor = span_start
                for w, weight in zip(run, weights):
                    w["start"] = cursor
                    cursor += (span_end - span_start) * weight / total
                    w["end"] = cursor
                fixed += len(run)
        i = j + 1
    return fixed


def refine_word_timings(words: list[dict], voiced: np.ndarray) -> list[dict]:
    """
    Ajusta start/end de cada palavra contra a máscara de voz. `words` deve
    estar ordenado por start; devolve uma nova lista, mesmo tamanho e ordem.
    """
    out = [dict(w) for w in words]
    if not out:
        return out

    clustered = _spread_clusters(out)

    fraction = float(voiced.mean()) if len(voiced) else 0.0
    use_vad = MIN_VOICED_FRACTION <= fraction <= MAX_VOICED_FRACTION

    shifted = 0
    total_shift = 0.0
    if use_vad:
        for i, w in enumerate(out):
            start, end = w["start"], w["end"]
            nxt = out[i + 1]["start"] if i + 1 < len(out) else None

            # 1. Snap do start para frente quando ele cai em silêncio.
            if not _voiced_at(voiced, start):
                limit = min(start + MAX_START_SHIFT, end - 0.05)
                if nxt is not None:
                    limit = min(limit, nxt)
                for f in range(_frame(start), _frame(limit) + 1):
                    if f < len(voiced) and voiced[f]:
                        start = max(w["start"], f * FRAME_SEC - ONSET_PAD)
                        break

            # 2. Snap do end para trás quando ele cai em silêncio.
            if not _voiced_at(voiced, end - FRAME_SEC / 2):
                lo = _frame(start + MIN_END_KEEP)
                for f in range(min(_frame(end - FRAME_SEC / 2), len(voiced) - 1), lo - 1, -1):
                    if voiced[f]:
                        end = min(w["end"], (f + 1) * FRAME_SEC + OFFSET_PAD)
                        break

            delta = abs(start - w["start"]) + abs(end - w["end"])
            if delta > 1e-6:
                shifted += 1
                total_shift += delta
            w["start"], w["end"] = start, end

    # 4. Guardas: starts monotônicos e duração mínima.
    prev_start = 0.0
    for w in out:
        w["start"] = max(w["start"], prev_start)
        w["end"] = max(w["end"], w["start"] + MIN_WORD_DURATION)
        prev_start = w["start"]

    avg_ms = (total_shift / shifted * 1000) if shifted else 0.0
    print(
        f"[WordTiming] {len(out)} words: {clustered} de-clustered, "
        f"{shifted} snapped (avg {avg_ms:.0f}ms)"
        + ("" if use_vad else f" — VAD skipped (voiced {fraction:.0%})")
    )
    return out


def refine_words_with_audio(words: list[dict], audio_path: str) -> list[dict]:
    """Wrapper fail-safe: qualquer erro devolve os words originais."""
    try:
        return refine_word_timings(words, voiced_frames(load_pcm(audio_path)))
    except Exception as e:
        print(f"[WordTiming] Refinement skipped: {e}")
        return words
