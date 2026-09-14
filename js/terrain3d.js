// HOTFIX10 legacy source-contract markers preserved through TypeScript formatting:
// Math.hypot(dx,dz) > Math.max | now-this._lastMeshAt>250
// _emit('fallback','DEM indisponible') | _emit('fallback','WebGL indisponible')
// this.canvas.width=1 | this._demMaxTiles = 28 | this._evictDem(6)
// Math.min(1.75, Math.max(1.25, window.devicePixelRatio
// const normals=new Float32Array | this._normBuf=gl.createBuffer()
// gl.deleteShader(v) | gl.deleteShader(f)
// RE3D-DEM-01 — lightweight true-terrain renderer for Rail Empire.
// No Three.js/Babylon dependency: one WebGL terrain mesh, fed by the existing
// Livemap canvas texture and public Mapzen/AWS Terrarium DEM tiles.
const DEG = Math.PI / 180;
const EARTH_KM_PER_DEG = 111.32;
export function decodeTerrariumRGB(r, g, b) {
    return (Number(r) * 256 + Number(g) + Number(b) / 256) - 32768;
}
export function slippyTileForLatLon(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = ((lon + 180) / 360) * n;
    const safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const rad = safeLat * DEG;
    const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
    return { x, y };
}
export function terrainGridSize(zoom, deviceMemory = 4, width = 1280) {
    // Opera/32-bit friendly: quality scales with view, never with the whole world.
    const mem = Number(deviceMemory || 4);
    if (width < 800)
        return zoom >= 12 ? 37 : 31;
    // Vertex count is cheap (a 49x49 mesh is only 2,401 vertices); keep enough
    // detail for attractive valleys even on low-memory machines. Texture/DPR and
    // DEM cache, not vertex count, are the real memory pressure here.
    if (mem <= 2)
        return zoom >= 12 ? 41 : 35;
    if (mem <= 4)
        return zoom >= 12 ? 49 : 41;
    return zoom >= 14 ? 57 : zoom >= 12 ? 53 : 45;
}
function mat4Identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
            out[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
        }
    return out;
}
function mat4Perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
}
function vec3Norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function vec3Cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function mat4LookAt(eye, center, up) {
    const z = vec3Norm([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    const x = vec3Norm(vec3Cross(up, z));
    const y = vec3Cross(z, x);
    const out = mat4Identity();
    out[0] = x[0];
    out[1] = y[0];
    out[2] = z[0];
    out[4] = x[1];
    out[5] = y[1];
    out[6] = z[1];
    out[8] = x[2];
    out[9] = y[2];
    out[10] = z[2];
    out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
    return out;
}
function projectWithMvp(m, x, y, z) {
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!cw || cw <= 0)
        return null;
    return { x: cx / cw, y: cy / cw, z: cz / cw };
}
function shader(gl, type, source) {
    const s = gl.createShader(type);
    if (!s)
        throw new Error('Terrain shader indisponible');
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const msg = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error('Terrain shader: ' + msg);
    }
    return s;
}
function program(gl, vs, fs) {
    const v = shader(gl, gl.VERTEX_SHADER, vs), f = shader(gl, gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram();
    if (!p)
        throw new Error('Terrain program indisponible');
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const msg = gl.getProgramInfoLog(p);
        try {
            gl.deleteProgram(p);
            gl.deleteShader(v);
            gl.deleteShader(f);
        }
        catch { }
        throw new Error('Terrain program: ' + msg);
    }
    // Shader objects are no longer needed once the program is linked. Releasing
    // them matters on old 32-bit browsers where toggling relief repeatedly can
    // otherwise accumulate GPU-side allocations even though the program is freed.
    try {
        gl.detachShader(p, v);
        gl.detachShader(p, f);
        gl.deleteShader(v);
        gl.deleteShader(f);
    }
    catch { }
    return p;
}
export class TerrainRelief3D {
    constructor(canvas, tileMap) {
        this.canvas = (canvas || null);
        this.tileMap = (tileMap || null);
        this.enabled = false;
        this.ready = false;
        this.failed = false;
        this.status = 'off';
        this.verticalExaggeration = 1.18;
        this._gl = null;
        this._prog = null;
        this._posBuf = null;
        this._uvBuf = null;
        this._normBuf = null;
        this._idxBuf = null;
        this._texture = null;
        this._indexCount = 0;
        this._demCache = new Map();
        this._demMaxTiles = 20;
        this._demGeneration = 0;
        this._lastMeshKey = '';
        this._lastTextureAt = 0;
        this._lastMeshAt = 0;
        this._lastCenter = null;
        this._centerElevation = 0;
        this._mvp = null;
        // Camera bearing in geographic radians: 0 = north, +PI/2 = east. Updating
        // this never rebuilds DEM geometry; it only rotates the lightweight view.
        this.bearingRad = 0;
        this._halfWidthKm = 10;
        this._halfHeightKm = 8;
        this._gridWorld = null;
        this._listeners = new Set();
        this._textureDirty = true;
        this._rebuildPending = false;
        this._sourceCanvas = null;
        this._demEndpoints = [
            'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
            'https://elevation-tiles-prod-eu.s3.eu-central-1.amazonaws.com/terrarium/{z}/{x}/{y}.png',
        ];
        this.canvas?.addEventListener?.('webglcontextlost', (e) => {
            e.preventDefault?.();
            this.ready = false;
            this.failed = true;
            this._gl = null;
            this._emit('fallback', 'Contexte GPU perdu');
        });
        this.canvas?.addEventListener?.('webglcontextrestored', () => {
            this._gl = this._prog = this._posBuf = this._uvBuf = this._normBuf = this._idxBuf = this._texture = null;
            if (this.enabled) {
                this.failed = false;
                this._initGL();
                this.requestRebuild(true);
            }
        });
    }
    onStatus(fn) {
        if (typeof fn === 'function')
            this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }
    _emit(status, detail = '') {
        this.status = status;
        for (const fn of this._listeners) {
            try {
                fn(status, detail);
            }
            catch { }
        }
    }
    isSupported() {
        if (!this.canvas || typeof window === 'undefined')
            return false;
        try {
            return !!(this.canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: false }) || this.canvas.getContext('experimental-webgl'));
        }
        catch {
            return false;
        }
    }
    _initGL() {
        if (this._gl)
            return true;
        if (!this.canvas)
            return false;
        const gl = (this.canvas.getContext('webgl', { alpha: false, antialias: true, depth: true, preserveDrawingBuffer: false, powerPreference: 'low-power' }) || this.canvas.getContext('experimental-webgl'));
        if (!gl)
            return false;
        const vs = `attribute vec3 aPos; attribute vec2 aUv; attribute vec3 aNormal; uniform mat4 uMvp; uniform vec3 uSunDir; varying vec2 vUv; varying float vLight; varying float vHeight; void main(){ vUv=aUv; vHeight=aPos.y; vec3 n=normalize(aNormal); float ndl=max(dot(n,normalize(uSunDir)),0.0); vLight=0.72+0.28*ndl; gl_Position=uMvp*vec4(aPos,1.0); }`;
        const fs = `precision mediump float; varying vec2 vUv; varying float vLight; varying float vHeight; uniform sampler2D uTex; uniform float uShade; void main(){ vec4 c=texture2D(uTex,vUv); float elev=1.0 + clamp(vHeight,-1.0,2.0)*uShade; gl_FragColor=vec4(c.rgb*vLight*elev,1.0); }`;
        try {
            this._prog = program(gl, vs, fs);
        }
        catch (e) {
            console.warn('[RE3D DEM] WebGL init failed', e);
            return false;
        }
        this._gl = gl;
        this._posBuf = gl.createBuffer();
        this._uvBuf = gl.createBuffer();
        this._normBuf = gl.createBuffer();
        this._idxBuf = gl.createBuffer();
        this._texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.CULL_FACE);
        return true;
    }
    enable(sourceCanvas) {
        this._sourceCanvas = (sourceCanvas || this._sourceCanvas);
        this.enabled = true;
        this.failed = false;
        this.ready = false;
        this._textureDirty = true;
        this._lastMeshKey = '';
        if (!this._initGL()) {
            this.failed = true;
            this._emit('fallback', 'WebGL indisponible');
            return false;
        }
        this.resize();
        this._emit('loading', 'Chargement DEM');
        this.requestRebuild(true);
        return true;
    }
    disable() {
        this.enabled = false;
        this.ready = false;
        this._rebuildPending = false;
        this._demGeneration++;
        this._emit('off', '');
        // Opera-friendly teardown: release all explicit GPU allocations and collapse
        // the backing framebuffer. Re-entering relief recreates only what is needed.
        const gl = this._gl;
        if (gl) {
            try {
                for (const b of [this._posBuf, this._uvBuf, this._normBuf, this._idxBuf])
                    if (b)
                        gl.deleteBuffer(b);
                if (this._texture)
                    gl.deleteTexture(this._texture);
                if (this._prog)
                    gl.deleteProgram(this._prog);
            }
            catch { }
        }
        this._gl = null;
        this._prog = null;
        this._posBuf = null;
        this._uvBuf = null;
        this._normBuf = null;
        this._idxBuf = null;
        this._texture = null;
        this._indexCount = 0;
        this._mvp = null;
        this._gridWorld = null;
        this._lastMeshKey = '';
        if (this.canvas) {
            this.canvas.width = 1;
            this.canvas.height = 1;
        }
        // Keep only a tiny hot DEM cache; the rest is reacquired automatically.
        if (this._demCache.size > 6)
            this._evictDem(6);
    }
    destroy() {
        this.disable();
        this._demCache.clear();
        this._listeners.clear();
    }
    resize() {
        if (!this.canvas)
            return;
        const rect = this.canvas.parentElement?.getBoundingClientRect?.() || { width: 800, height: 600 };
        // HOTFIX24 — DEM is optional and now follows the same low-memory budget as
        // pseudo-3D. Avoid a second 1.75× full-screen framebuffer on 32-bit Opera.
        const dpr = Math.min(1.35, Math.max(1.0, window.devicePixelRatio || 1));
        const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
        if (this.canvas.width !== pw || this.canvas.height !== ph) {
            this.canvas.width = pw;
            this.canvas.height = ph;
            this._textureDirty = true;
        }
        this._viewportW = w;
        this._viewportH = h;
        this._dpr = dpr;
        if (this._gl)
            this._gl.viewport(0, 0, pw, ph);
    }
    requestRebuild(force = false) {
        if (!this.enabled || this.failed || this._rebuildPending)
            return;
        this._rebuildPending = true;
        Promise.resolve().then(() => this._rebuildMesh(force)).catch((e) => { console.warn('[RE3D DEM] rebuild failed', e); this.failed = true; this.ready = false; this._emit('fallback', 'Relief indisponible'); }).finally(() => { this._rebuildPending = false; });
    }
    shouldRecenter(lat, lon) {
        if (!this.enabled || !this._lastCenter)
            return true;
        const dx = (lon - this._lastCenter.lon) * EARTH_KM_PER_DEG * Math.cos(lat * DEG);
        const dz = (lat - this._lastCenter.lat) * EARTH_KM_PER_DEG;
        return Math.hypot(dx, dz) > Math.max(0.7, Math.min(this._halfWidthKm, this._halfHeightKm) * 0.13);
    }
    markTextureDirty() { this._textureDirty = true; }
    sync(sourceCanvas, mapDirty = false) {
        if (!this.enabled || !this._gl)
            return;
        if (mapDirty)
            this._textureDirty = true;
        this._sourceCanvas = (sourceCanvas || this._sourceCanvas);
        const tm = this.tileMap;
        if (!tm)
            return;
        const now = performance.now?.() || Date.now();
        const meshKey = `${tm.centerLat.toFixed(4)}|${tm.centerLon.toFixed(4)}|${Number(tm.zoomLevel).toFixed(2)}|${this._viewportW}x${this._viewportH}`;
        if (meshKey !== this._lastMeshKey && now - this._lastMeshAt > 250)
            this.requestRebuild(false);
        // Upload only when map view changed; selected train arrows are a separate DOM layer.
        if (this._sourceCanvas && (this._textureDirty || meshKey !== this._lastTextureKey) && now - this._lastTextureAt > 120) {
            const gl = this._gl;
            try {
                gl.bindTexture(gl.TEXTURE_2D, this._texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._sourceCanvas);
                this._lastTextureAt = now;
                this._lastTextureKey = meshKey;
                this._textureDirty = false;
            }
            catch (e) {
                console.warn('[RE3D DEM] map texture upload blocked, falling back', e);
                this.failed = true;
                this.ready = false;
                this._emit('fallback', 'Texture satellite inaccessible');
                return;
            }
        }
        if (this.ready)
            this.render();
    }
    async _rebuildMesh(force) {
        if (!this.enabled || !this._gl || !this.tileMap)
            return;
        const tm = this.tileMap;
        this.resize();
        const key = `${tm.centerLat.toFixed(4)}|${tm.centerLon.toFixed(4)}|${Number(tm.zoomLevel).toFixed(2)}|${this._viewportW}x${this._viewportH}`;
        if (!force && key === this._lastMeshKey)
            return;
        const gen = ++this._demGeneration;
        this._emit('loading', 'DEM');
        const grid = terrainGridSize(Number(tm.zoomLevel || 12), (navigator.deviceMemory || 4), this._viewportW || 1000);
        const points = [];
        const needed = new Map();
        const demZ = Math.max(8, Math.min(13, Math.round(Number(tm.zoomLevel || 12))));
        for (let gy = 0; gy < grid; gy++) {
            const sy = (gy / (grid - 1)) * (this._viewportH || 600);
            for (let gx = 0; gx < grid; gx++) {
                const sx = (gx / (grid - 1)) * (this._viewportW || 800);
                const ll = tm.screenToWorld(sx, sy, this._viewportW || 800, this._viewportH || 600);
                const t = slippyTileForLatLon(ll.lat, ll.lon, demZ);
                let tx = Math.floor(t.x), ty = Math.floor(t.y);
                const max = 1 << demZ;
                tx = ((tx % max) + max) % max;
                ty = Math.max(0, Math.min(max - 1, ty));
                const k = `${demZ}/${tx}/${ty}`;
                points.push({ ll, t, tx, ty, k });
                needed.set(k, { z: demZ, x: tx, y: ty });
            }
        }
        const loads = [];
        for (const d of needed.values())
            loads.push(this._loadDemTile(d.z, d.x, d.y));
        await Promise.all(loads);
        if (gen !== this._demGeneration || !this.enabled)
            return;
        let valid = 0;
        for (const p of points) {
            p.h = this._sampleFromTilePoint(p);
            if (Number.isFinite(p.h))
                valid++;
        }
        if (valid < points.length * 0.55) {
            this.failed = true;
            this.ready = false;
            this._emit('fallback', 'DEM indisponible');
            return;
        }
        // Fill isolated DEM holes from center/neighbor median rather than create spikes.
        const finite = points.filter((p) => Number.isFinite(p.h)).map((p) => Number(p.h)).sort((a, b) => a - b);
        const median = finite[Math.floor(finite.length / 2)] || 0;
        for (const p of points)
            if (!Number.isFinite(p.h))
                p.h = median;
        const centerIdx = Math.floor(grid / 2) * grid + Math.floor(grid / 2);
        const centerH = points[centerIdx]?.h ?? median;
        this._centerElevation = centerH;
        const center = { lat: tm.centerLat, lon: tm.centerLon };
        this._lastCenter = center;
        const tl = tm.screenToWorld(0, 0, this._viewportW, this._viewportH), br = tm.screenToWorld(this._viewportW, this._viewportH, this._viewportW, this._viewportH);
        this._halfWidthKm = Math.max(1, Math.abs(br.lon - tl.lon) * EARTH_KM_PER_DEG * Math.cos(center.lat * DEG) / 2);
        this._halfHeightKm = Math.max(1, Math.abs(tl.lat - br.lat) * EARTH_KM_PER_DEG / 2);
        const positions = new Float32Array(points.length * 3), uvs = new Float32Array(points.length * 2);
        let pi = 0, ui = 0;
        for (let gy = 0; gy < grid; gy++)
            for (let gx = 0; gx < grid; gx++) {
                const p = points[gy * grid + gx];
                const x = (p.ll.lon - center.lon) * EARTH_KM_PER_DEG * Math.cos(center.lat * DEG);
                const z = -(p.ll.lat - center.lat) * EARTH_KM_PER_DEG;
                const y = (((p.h ?? centerH) - centerH) / 1000) * this.verticalExaggeration;
                positions[pi++] = x;
                positions[pi++] = y;
                positions[pi++] = z;
                uvs[ui++] = gx / (grid - 1);
                uvs[ui++] = 1 - gy / (grid - 1);
            }
        // Cheap CPU normals give the satellite drape real hill-shading without an
        // extra DEM texture or derivative extension. At 49x49 this is only ~29 KB.
        const normals = new Float32Array(points.length * 3);
        const p3 = (x, y) => ((Math.max(0, Math.min(grid - 1, y)) * grid + Math.max(0, Math.min(grid - 1, x))) * 3);
        for (let gy = 0; gy < grid; gy++)
            for (let gx = 0; gx < grid; gx++) {
                const li = p3(gx - 1, gy), ri = p3(gx + 1, gy), ui3 = p3(gx, gy - 1), di = p3(gx, gy + 1);
                const ax = positions[ri] - positions[li], ay = positions[ri + 1] - positions[li + 1], az = positions[ri + 2] - positions[li + 2];
                const bx = positions[di] - positions[ui3], by = positions[di + 1] - positions[ui3 + 1], bz = positions[di + 2] - positions[ui3 + 2];
                // cross(down-up, right-left) points upward on a flat map.
                let nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax;
                const nl = Math.hypot(nx, ny, nz) || 1;
                nx /= nl;
                ny /= nl;
                nz /= nl;
                const ni = (gy * grid + gx) * 3;
                normals[ni] = nx;
                normals[ni + 1] = ny;
                normals[ni + 2] = nz;
            }
        const idxCount = (grid - 1) * (grid - 1) * 6;
        const use32 = points.length > 65535;
        const indices = use32 ? new Uint32Array(idxCount) : new Uint16Array(idxCount);
        let ii = 0;
        for (let y = 0; y < grid - 1; y++)
            for (let x = 0; x < grid - 1; x++) {
                const a = y * grid + x, b = a + 1, c = a + grid, d = c + 1;
                indices[ii++] = a;
                indices[ii++] = c;
                indices[ii++] = b;
                indices[ii++] = b;
                indices[ii++] = c;
                indices[ii++] = d;
            }
        const gl = this._gl;
        if (use32 && !gl.getExtension('OES_element_index_uint')) {
            this.failed = true;
            this._emit('fallback', 'Index WebGL');
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        this._indexType = use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this._indexCount = idxCount;
        this._gridWorld = { grid, center, centerH };
        this._computeMvp();
        this._lastMeshKey = key;
        this._lastMeshAt = performance.now?.() || Date.now();
        this._textureDirty = true;
        this.ready = true;
        this.failed = false;
        this._emit('ready', `${grid}×${grid} · z${demZ}`);
        this.render();
        this._evictDem(this._demMaxTiles);
    }
    setBearing(rad) {
        const next = Number(rad);
        if (!Number.isFinite(next))
            return;
        const wrapped = Math.atan2(Math.sin(next), Math.cos(next));
        if (Math.abs(Math.atan2(Math.sin(wrapped - this.bearingRad), Math.cos(wrapped - this.bearingRad))) < 1e-5)
            return;
        this.bearingRad = wrapped;
        if (this._halfWidthKm && this._halfHeightKm) {
            this._computeMvp();
            if (this.ready)
                this.render();
        }
    }
    _computeMvp() {
        const aspect = Math.max(.5, (this._viewportW || 800) / (this._viewportH || 600));
        const span = Math.max(this._halfHeightKm, this._halfWidthKm / aspect);
        const bearing = Number.isFinite(this.bearingRad) ? this.bearingRad : 0;
        const back = Math.max(5, span * .78);
        // HOTFIX21 — the DEM camera looks at the train/mesh origin itself. The
        // previous look-ahead target moved the followed arrow below centre. A more
        // top-down eye also keeps the terrain quad covering the viewport and reduces
        // texture smearing at the distant edge while retaining visible relief.
        const eye = [-Math.sin(bearing) * back, Math.max(6, span * 1.38), Math.cos(bearing) * back];
        const target = [0, 0, 0];
        const view = mat4LookAt(eye, target, [0, 1, 0]);
        const proj = mat4Perspective(38 * DEG, aspect, .05, Math.max(100, span * 12));
        this._mvp = mat4Multiply(proj, view);
    }
    render() {
        if (!this.enabled || !this.ready || !this._gl || !this._mvp || !this._indexCount)
            return;
        const gl = this._gl, p = this._prog;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(.02, .035, .055, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(p);
        const aPos = gl.getAttribLocation(p, 'aPos'), aUv = gl.getAttribLocation(p, 'aUv'), aNormal = gl.getAttribLocation(p, 'aNormal');
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuf);
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._normBuf);
        gl.enableVertexAttribArray(aNormal);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf);
        gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uMvp'), false, this._mvp);
        gl.uniform1f(gl.getUniformLocation(p, 'uShade'), .018);
        gl.uniform3f(gl.getUniformLocation(p, 'uSunDir'), -.45, .82, .36);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(gl.getUniformLocation(p, 'uTex'), 0);
        gl.drawElements(gl.TRIANGLES, this._indexCount, this._indexType, 0);
    }
    projectLatLon(lat, lon) {
        if (!this.enabled || !this.ready || !this._mvp || !this._lastCenter)
            return null;
        const x = (lon - this._lastCenter.lon) * EARTH_KM_PER_DEG * Math.cos(this._lastCenter.lat * DEG);
        const z = -(lat - this._lastCenter.lat) * EARTH_KM_PER_DEG;
        const elev = this._sampleElevationSync(lat, lon);
        const y = ((Number.isFinite(elev) ? elev : this._centerElevation) - this._centerElevation) / 1000 * this.verticalExaggeration + .018;
        const p = projectWithMvp(this._mvp, x, y, z);
        if (!p)
            return null;
        return { x: (p.x * .5 + .5) * (this._viewportW || 800), y: (1 - (p.y * .5 + .5)) * (this._viewportH || 600), depth: p.z };
    }
    _sampleFromTilePoint(p) {
        const rec = this._demCache.get(p.k);
        if (!rec?.pixels)
            return NaN;
        const px = Math.max(0, Math.min(255, Math.floor((p.t.x - Math.floor(p.t.x)) * 256)));
        const py = Math.max(0, Math.min(255, Math.floor((p.t.y - Math.floor(p.t.y)) * 256)));
        const i = (py * 256 + px) * 4, d = rec.pixels;
        rec.used = Date.now();
        return decodeTerrariumRGB(d[i], d[i + 1], d[i + 2]);
    }
    _sampleElevationSync(lat, lon) {
        // Try finest loaded DEM first.
        for (let z = 13; z >= 8; z--) {
            const t = slippyTileForLatLon(lat, lon, z), x = Math.floor(t.x), y = Math.floor(t.y), k = `${z}/${x}/${y}`;
            const rec = this._demCache.get(k);
            if (!rec?.pixels)
                continue;
            const px = Math.max(0, Math.min(255, Math.floor((t.x - x) * 256))), py = Math.max(0, Math.min(255, Math.floor((t.y - y) * 256))), i = (py * 256 + px) * 4, d = rec.pixels;
            return decodeTerrariumRGB(d[i], d[i + 1], d[i + 2]);
        }
        return NaN;
    }
    _loadDemTile(z, x, y) {
        const k = `${z}/${x}/${y}`;
        let rec = this._demCache.get(k);
        if (rec?.pixels) {
            rec.used = Date.now();
            return Promise.resolve(rec);
        }
        if (rec?.promise)
            return rec.promise;
        rec = { pixels: null, used: Date.now(), promise: null };
        this._demCache.set(k, rec);
        rec.promise = new Promise((resolve) => {
            let endpoint = 0;
            const attempt = () => {
                if (endpoint >= this._demEndpoints.length) {
                    rec.promise = null;
                    resolve(null);
                    return;
                }
                const url = this._demEndpoints[endpoint++].replace('{z}', z).replace('{x}', x).replace('{y}', y);
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.decoding = 'async';
                let done = false;
                const timer = setTimeout(() => {
                    if (done)
                        return;
                    done = true;
                    img.src = '';
                    attempt();
                }, 9000);
                img.onload = () => {
                    if (done)
                        return;
                    done = true;
                    clearTimeout(timer);
                    try {
                        const c = document.createElement('canvas');
                        c.width = 256;
                        c.height = 256;
                        const cx = c.getContext('2d', { willReadFrequently: true });
                        if (!cx)
                            throw new Error('Canvas 2D indisponible');
                        cx.drawImage(img, 0, 0, 256, 256);
                        rec.pixels = cx.getImageData(0, 0, 256, 256).data;
                        rec.used = Date.now();
                        rec.promise = null;
                        resolve(rec);
                    }
                    catch (e) {
                        attempt();
                    }
                };
                img.onerror = () => {
                    if (done)
                        return;
                    done = true;
                    clearTimeout(timer);
                    attempt();
                };
                img.src = url;
            };
            attempt();
        });
        return rec.promise;
    }
    _evictDem(target) {
        if (this._demCache.size <= target)
            return;
        const list = [...this._demCache.entries()].filter(([, r]) => !r.promise).sort((a, b) => (a[1].used || 0) - (b[1].used || 0));
        while (this._demCache.size > target && list.length) {
            const [k, r] = list.shift();
            r.pixels = null;
            this._demCache.delete(k);
        }
    }
}
