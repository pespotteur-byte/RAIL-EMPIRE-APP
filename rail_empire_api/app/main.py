from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for crash test
_state = {}

@app.get("/healthz")
async def healthz():
    return {"status": "ok", "trains": len(_state)}

@app.post("/save/{key}")
async def save_state(key: str, payload: dict):
    _state[key] = payload
    return {"saved": True, "key": key, "size": len(payload)}

@app.get("/load/{key}")
async def load_state(key: str):
    return _state.get(key, {})

@app.post("/crash-test/{n}")
async def crash_test(n: int):
    records = []
    for i in range(n):
        records.append({
            "id": f"train-{i}",
            "lat": 52.3 + (i % 100) * 0.001,
            "lon": 9.7 + (i % 100) * 0.001,
            "speed": (i % 160),
            "delay": i % 120,
        })
    return {"generated": n, "sample": records[:3], "memory_mb": len(str(records)) / (1024 * 1024)}
