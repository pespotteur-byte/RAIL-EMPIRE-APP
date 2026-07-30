import os
import io
import asyncio
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
import soundfile as sf
import sherpa_onnx

MODEL_DIR = os.environ.get("RE_TTS_MODEL_DIR", "/home/ubuntu/re_tts/models/vits-piper-fr_FR-mls-medium")

# Auto-detect the ONNX model file in the model directory.
MODEL_FILES = [f for f in os.listdir(MODEL_DIR) if f.endswith(".onnx")]
if not MODEL_FILES:
    raise RuntimeError(f"No .onnx model found in {MODEL_DIR}")
MODEL_PATH = os.path.join(MODEL_DIR, MODEL_FILES[0])
TOKENS_PATH = os.path.join(MODEL_DIR, "tokens.txt")
DATA_DIR = os.path.join(MODEL_DIR, "espeak-ng-data")

_tts = None


def _load_tts():
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model not found: {MODEL_PATH}")
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=MODEL_PATH,
                data_dir=DATA_DIR,
                tokens=TOKENS_PATH,
                dict_dir="",
            ),
            num_threads=int(os.environ.get("RE_TTS_NUM_THREADS", "2")),
            debug=False,
        ),
    )
    if not config.validate():
        raise RuntimeError("TTS config validation failed")
    return sherpa_onnx.OfflineTts(config)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _tts
    _tts = _load_tts()
    yield
    _tts = None


app = FastAPI(title="Rail Empire TTS", lifespan=lifespan)


def _synthesize(text: str, speed: float = 1.0):
    audio = _tts.generate(text=text, sid=0, speed=float(speed))
    buf = io.BytesIO()
    sf.write(buf, audio.samples, samplerate=audio.sample_rate, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf


@app.get("/health")
async def health():
    return {"ok": _tts is not None}


@app.get("/voices")
async def voices():
    return {"voices": [{"id": "mls-medium", "name": "mls (fr_FR, male)", "lang": "fr-FR"}]}


@app.post("/tts")
async def tts(text: str = Query(..., min_length=1, max_length=500), speed: float = Query(1.0, ge=0.5, le=2.0)):
    if _tts is None:
        raise HTTPException(status_code=503, detail="TTS not ready")
    try:
        buf = await asyncio.to_thread(_synthesize, text, speed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return StreamingResponse(buf, media_type="audio/wav", headers={"Content-Disposition": "inline; filename=announcement.wav"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8137")))
