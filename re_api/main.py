import asyncio
import json
import os
from contextlib import asynccontextmanager

import asyncpg
import boto3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from botocore.exceptions import ClientError

DB_DSN = os.environ.get(
    "DATABASE_URL", "postgresql://rail:railpass@localhost:5432/rail_empire"
)
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.environ.get("S3_BUCKET", "rail-empire")
S3_OFFLOAD_BYTES = int(os.environ.get("S3_OFFLOAD_BYTES", "1048576"))

_state = {}
_db_pool = None
_s3 = None


async def init_db_pool():
    global _db_pool
    _db_pool = await asyncpg.create_pool(DB_DSN, min_size=2, max_size=10)
    async with _db_pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saves (
                id SERIAL PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                payload JSONB,
                s3_key TEXT,
                size_bytes BIGINT DEFAULT 0,
                updated_at TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_saves_key ON saves(key);
            CREATE TABLE IF NOT EXISTS tracks (
                id BIGSERIAL PRIMARY KEY,
                way_id BIGINT,
                tags JSONB,
                v_max INT,
                geom GEOMETRY(LineString, 4326),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_tracks_geom ON tracks USING GIST(geom);
            CREATE INDEX IF NOT EXISTS idx_tracks_way_id ON tracks(way_id);
            CREATE TABLE IF NOT EXISTS track_nodes (
                id BIGSERIAL PRIMARY KEY,
                node_id BIGINT,
                lat DOUBLE PRECISION,
                lon DOUBLE PRECISION,
                tags JSONB,
                geom GEOMETRY(Point, 4326),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_track_nodes_geom ON track_nodes USING GIST(geom);
            """
        )


def init_s3():
    global _s3
    _s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
    )
    try:
        _s3.create_bucket(Bucket=S3_BUCKET)
    except ClientError as e:
        if e.response["Error"]["Code"] not in ("BucketAlreadyExists", "BucketAlreadyOwnedByYou"):
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_pool()
    init_s3()
    yield
    if _db_pool:
        await _db_pool.close()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz():
    db_ok = False
    if _db_pool:
        try:
            async with _db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT 1")
                db_ok = row is not None
        except Exception:
            pass
    return {"status": "ok", "db": db_ok, "trains": len(_state)}


@app.post("/save/{key}")
async def save_state(key: str, payload: dict):
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database not available")

    data = json.dumps(payload, ensure_ascii=False)
    size = len(data.encode("utf-8"))
    s3_key = None

    if size > S3_OFFLOAD_BYTES:
        s3_key = f"saves/{key}.json"
        await asyncio.to_thread(
            _s3.put_object, Bucket=S3_BUCKET, Key=s3_key, Body=data.encode("utf-8"), ContentType="application/json"
        )
        payload_db = None
    else:
        payload_db = json.dumps(payload, ensure_ascii=False)

    async with _db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO saves (key, payload, s3_key, size_bytes, updated_at)
            VALUES ($1, $2, $3, $4, now())
            ON CONFLICT (key) DO UPDATE
            SET payload = EXCLUDED.payload,
                s3_key = EXCLUDED.s3_key,
                size_bytes = EXCLUDED.size_bytes,
                updated_at = EXCLUDED.updated_at
            """,
            key,
            payload_db,
            s3_key,
            size,
        )
    return {"saved": True, "key": key, "size": size, "s3": s3_key is not None}


@app.get("/load/{key}")
async def load_state(key: str):
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database not available")

    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT payload, s3_key FROM saves WHERE key = $1", key
        )
    if not row:
        raise HTTPException(status_code=404, detail="Save not found")

    if row["s3_key"]:
        obj = await asyncio.to_thread(_s3.get_object, Bucket=S3_BUCKET, Key=row["s3_key"])
        body = obj["Body"].read()
        return json.loads(body.decode("utf-8"))
    payload = row["payload"]
    if isinstance(payload, str):
        return json.loads(payload)
    return payload or {}


@app.get("/saves")
async def list_saves():
    if _db_pool is None:
        return []
    async with _db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT key, size_bytes, updated_at, s3_key IS NOT NULL AS s3 FROM saves ORDER BY updated_at DESC"
        )
    return [dict(r) for r in rows]


@app.delete("/delete/{key}")
async def delete_state(key: str):
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT s3_key FROM saves WHERE key = $1", key
        )
        if row and row["s3_key"]:
            try:
                await asyncio.to_thread(_s3.delete_object, Bucket=S3_BUCKET, Key=row["s3_key"])
            except ClientError:
                pass
        await conn.execute("DELETE FROM saves WHERE key = $1", key)
    return {"deleted": True, "key": key}


@app.post("/crash-test/{n}")
async def crash_test(n: int):
    records = [
        {
            "id": f"train-{i}",
            "lat": 52.3 + (i % 100) * 0.001,
            "lon": 9.7 + (i % 100) * 0.001,
            "speed": i % 160,
            "delay": i % 120,
        }
        for i in range(n)
    ]
    return {"generated": n, "sample": records[:3], "memory_mb": len(str(records)) / (1024 * 1024)}


@app.post("/ingest-tracks")
async def ingest_tracks(tracks: list):
    """Bulk ingest track ways. Expects [{way_id, tags, v_max, coords:[[lon,lat],...]}, ...]."""
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    inserted = 0
    async with _db_pool.acquire() as conn:
        for t in tracks:
            coords = t.get("coords", [])
            if len(coords) < 2:
                continue
            # PostGIS ST_SetSRID(ST_MakeLine(array[ST_MakePoint...]), 4326)
            point_array = ", ".join(f"ST_MakePoint({c[0]}, {c[1]})" for c in coords)
            await conn.execute(
                f"""
                INSERT INTO tracks (way_id, tags, v_max, geom, updated_at)
                VALUES ($1, $2, $3, ST_SetSRID(ST_MakeLine(ARRAY[{point_array}]), 4326), now())
                ON CONFLICT (way_id) DO UPDATE
                SET tags = EXCLUDED.tags,
                    v_max = EXCLUDED.v_max,
                    geom = EXCLUDED.geom,
                    updated_at = EXCLUDED.updated_at
                """,
                t.get("way_id"),
                json.dumps(t.get("tags", {})),
                t.get("v_max"),
            )
            inserted += 1
    return {"inserted": inserted}


app.mount("/", StaticFiles(directory="/home/ubuntu/rail-empire-deploy", html=True), name="static")
