import asyncio
import json
import mimetypes
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg
import boto3
import jwt
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from botocore.exceptions import ClientError
from passlib.context import CryptContext

DB_DSN = os.environ.get(
    "DATABASE_URL", "postgresql://rail:railpass@localhost:5432/rail_empire"
)
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.environ.get("S3_BUCKET", "rail-empire")
S3_OFFLOAD_BYTES = int(os.environ.get("S3_OFFLOAD_BYTES", "1048576"))
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "30"))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
_state = {}
_db_pool = None
_s3 = None


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_token(user_id: int, username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "username": username, "exp": exp},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None


async def get_current_user(x_api_token: Optional[str] = Header(None)) -> Optional[dict]:
    if not x_api_token:
        return None
    payload = decode_token(x_api_token)
    if not payload:
        return None
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        return None
    return {"id": user_id, "username": payload.get("username")}


def user_id(user: Optional[dict]) -> int:
    return user["id"] if user else 0


async def init_db_pool():
    global _db_pool
    _db_pool = await asyncpg.create_pool(DB_DSN, min_size=2, max_size=10)
    async with _db_pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='saves' AND column_name='user_id'
                ) THEN
                    ALTER TABLE saves ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
                END IF;
            END $$;

            -- Replace previous single-column unique with per-user unique
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE indexname = 'saves_key_key'
                ) THEN
                    ALTER TABLE saves DROP CONSTRAINT saves_key_key;
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE indexname = 'saves_user_key_unique'
                ) THEN
                    ALTER TABLE saves ADD CONSTRAINT saves_user_key_unique UNIQUE (user_id, key);
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS saves (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL DEFAULT 0,
                key TEXT NOT NULL,
                payload JSONB,
                s3_key TEXT,
                size_bytes BIGINT DEFAULT 0,
                updated_at TIMESTAMPTZ DEFAULT now(),
                CONSTRAINT saves_user_key_unique UNIQUE (user_id, key)
            );
            CREATE INDEX IF NOT EXISTS idx_saves_lookup ON saves(user_id, key);
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

            CREATE TABLE IF NOT EXISTS liveries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                file_key TEXT NOT NULL,
                target_category TEXT DEFAULT 'all',
                content_type TEXT,
                size_bytes BIGINT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_liveries_user ON liveries(user_id);
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
        code = e.response.get("Error", {}).get("Code", "")
        if code not in ("BucketAlreadyExists", "BucketAlreadyOwnedByYou"):
            raise


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


@app.post("/auth/register")
async def register(credentials: dict):
    username = credentials.get("username", "").strip()
    password = credentials.get("password", "")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    pw_hash = hash_password(password)
    async with _db_pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
                username,
                pw_hash,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="Username already taken")
    token = create_token(row["id"], row["username"])
    return {"token": token, "username": row["username"]}


@app.post("/auth/login")
async def login(credentials: dict):
    username = credentials.get("username", "").strip()
    password = credentials.get("password", "")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, username, password_hash FROM users WHERE username = $1",
            username,
        )
    if not row or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(row["id"], row["username"])
    return {"token": token, "username": row["username"]}


@app.get("/auth/me")
async def auth_me(user: Optional[dict] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@app.post("/save/{key}")
async def save_state(key: str, payload: dict, user: Optional[dict] = Depends(get_current_user)):
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database not available")

    uid = user_id(user)
    data = json.dumps(payload, ensure_ascii=False)
    size = len(data.encode("utf-8"))
    s3_key = None

    if size > S3_OFFLOAD_BYTES:
        s3_key = f"saves/{uid}/{key}.json"
        await asyncio.to_thread(
            _s3.put_object,
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=data.encode("utf-8"),
            ContentType="application/json",
        )
        payload_db = None
    else:
        payload_db = json.dumps(payload, ensure_ascii=False)

    async with _db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO saves (user_id, key, payload, s3_key, size_bytes, updated_at)
            VALUES ($1, $2, $3, $4, $5, now())
            ON CONFLICT (user_id, key) DO UPDATE
            SET payload = EXCLUDED.payload,
                s3_key = EXCLUDED.s3_key,
                size_bytes = EXCLUDED.size_bytes,
                updated_at = EXCLUDED.updated_at
            """,
            uid,
            key,
            payload_db,
            s3_key,
            size,
        )
    return {"saved": True, "key": key, "user": user["username"] if user else None, "size": size, "s3": s3_key is not None}


@app.get("/load/{key}")
async def load_state(key: str, user: Optional[dict] = Depends(get_current_user)):
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database not available")

    uid = user_id(user)
    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT payload, s3_key FROM saves WHERE user_id = $1 AND key = $2",
            uid,
            key,
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
async def list_saves(user: Optional[dict] = Depends(get_current_user)):
    if _db_pool is None:
        return []
    uid = user_id(user)
    async with _db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT key, size_bytes, updated_at, s3_key IS NOT NULL AS s3 FROM saves WHERE user_id = $1 ORDER BY updated_at DESC",
            uid,
        )
    return [dict(r) for r in rows]


@app.delete("/delete/{key}")
async def delete_state(key: str, user: Optional[dict] = Depends(get_current_user)):
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    uid = user_id(user)
    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT s3_key FROM saves WHERE user_id = $1 AND key = $2",
            uid,
            key,
        )
        if row and row["s3_key"]:
            try:
                await asyncio.to_thread(_s3.delete_object, Bucket=S3_BUCKET, Key=row["s3_key"])
            except ClientError:
                pass
        await conn.execute(
            "DELETE FROM saves WHERE user_id = $1 AND key = $2",
            uid,
            key,
        )
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


@app.post("/liveries")
async def upload_livery(
    name: str = Form(...),
    target_category: str = Form(""),
    file: UploadFile = File(...),
    user: Optional[dict] = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name required")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in ("png", "jpg", "jpeg", "webp", "gif"):
        ext = "png"
    file_key = f"liveries/{user['id']}/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or mimetypes.guess_type(f"x.{ext}")[0] or "image/png"

    await asyncio.to_thread(
        _s3.put_object,
        Bucket=S3_BUCKET,
        Key=file_key,
        Body=content,
        ContentType=content_type,
    )

    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO liveries (user_id, name, file_key, target_category, content_type, size_bytes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            """,
            user["id"],
            name.strip(),
            file_key,
            target_category.strip() or "all",
            content_type,
            len(content),
        )
    return {
        "id": row["id"],
        "name": name.strip(),
        "target_category": target_category.strip() or "all",
        "url": f"/liveries/{row['id']}",
        "size": len(content),
    }


@app.get("/liveries")
async def list_liveries(user: Optional[dict] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    async with _db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, target_category, size_bytes, updated_at FROM liveries WHERE user_id = $1 ORDER BY updated_at DESC",
            user["id"],
        )
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "target_category": r["target_category"],
            "size": r["size_bytes"],
            "url": f"/liveries/{r['id']}",
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        }
        for r in rows
    ]


@app.get("/liveries/{livery_id}")
async def get_livery(livery_id: int, user: Optional[dict] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT file_key, content_type FROM liveries WHERE id = $1 AND user_id = $2",
            livery_id,
            user["id"],
        )
    if not row:
        raise HTTPException(status_code=404, detail="Livery not found")
    obj = await asyncio.to_thread(_s3.get_object, Bucket=S3_BUCKET, Key=row["file_key"])
    body = obj["Body"].read()
    return Response(content=body, media_type=row["content_type"] or "image/png")


@app.delete("/liveries/{livery_id}")
async def delete_livery(livery_id: int, user: Optional[dict] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    async with _db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT file_key FROM liveries WHERE id = $1 AND user_id = $2 RETURNING file_key",
            livery_id,
            user["id"],
        )
        if not row:
            raise HTTPException(status_code=404, detail="Livery not found")
        await conn.execute("DELETE FROM liveries WHERE id = $1", livery_id)
    try:
        await asyncio.to_thread(_s3.delete_object, Bucket=S3_BUCKET, Key=row["file_key"])
    except ClientError:
        pass
    return {"deleted": True, "id": livery_id}


app.mount("/", StaticFiles(directory="/home/ubuntu/rail-empire-deploy", html=True), name="static")
