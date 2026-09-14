/** RC19. Navigation changes the viewport/cursor, never the financial values. */
export interface ChartPoint { time: string; value: number | null; }
export interface ChartSeries { name: string; color: string; points: readonly ChartPoint[]; }
export interface ChartView { start: number; end: number; cursor: number; follow: boolean; }
export function chartWindow(count: number, start: number, end: number): [number, number] {
    const last = Math.max(0, count - 1);
    const lo = Math.max(0, Math.min(last, Math.trunc(Number.isFinite(start) ? start : 0)));
    return [lo, Math.max(lo, Math.min(last, Math.trunc(Number.isFinite(end) ? end : last)))];
}
export function zoomChartWindow(count: number, start: number, end: number, anchor: number, factor: number): [number, number] {
    const [lo, hi] = chartWindow(count, start, end), span = Math.max(1, hi - lo);
    const wanted = Math.max(1, Math.min(Math.max(1, count - 1), Math.round(span * factor)));
    const ratio = Math.max(0, Math.min(1, (anchor - lo) / span));
    const left = Math.max(0, Math.min(Math.max(0, count - 1 - wanted), Math.round(anchor - wanted * ratio)));
    return chartWindow(count, left, left + wanted);
}
export function renderInteractiveChart(canvas: HTMLCanvasElement, series: readonly ChartSeries[], unit: string,
    view: ChartView, options: { bars?: boolean; min?: number; max?: number } = {}): void {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let count = 0; for (const row of series) count = Math.max(count, row.points.length);
    const last = Math.max(0, count - 1);
    if (view.follow) { view.end = last; view.start = Math.max(0, last - 287); view.cursor = last; }
    [view.start, view.end] = chartWindow(count, view.start, view.end);
    view.cursor = Math.max(view.start, Math.min(view.end, view.cursor));
    // Fixed CSS height avoids compounding the backing-store DPR on successive paints.
    const width = Math.max(160, canvas.clientWidth || 600), height = 180;
    const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
    canvas.style.height = height + 'px'; canvas.style.width = '100%';
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.touchAction = 'pan-y'; canvas.style.cursor = 'grab';
    canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Graphique interactif en lecture seule. Glisser pour lire les points, molette pour zoomer. Flèches pour déplacer le curseur.');
    const controls = document.createElement('div'); controls.className = 're-chart-controls';
    const readout = document.createElement('output'); readout.className = 're-chart-readout';
    const instructions = document.createElement('div'); instructions.className = 're-chart-help';
    instructions.textContent = 'Saisir un point pour le lire · molette : zoom · poignées : période · valeurs non modifiables';
    const rangeBox = document.createElement('div'); rangeBox.className = 're-chart-range';
    const first = document.createElement('input'), final = document.createElement('input');
    for (const [input, label] of [[first, 'Début de période'], [final, 'Fin de période']] as const) {
        input.type = 'range'; input.min = '0'; input.max = String(last); input.step = '1';
        input.setAttribute('aria-label', label); input.disabled = count < 2;
        const wrapper = document.createElement('label'); wrapper.textContent = label; wrapper.append(input); rangeBox.append(wrapper);
    }
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn-secondary'; reset.textContent = 'Tout';
    const live = document.createElement('button'); live.type = 'button'; live.className = 'btn-secondary'; live.textContent = 'Derniers points';
    controls.append(readout, rangeBox, reset, live, instructions); canvas.insertAdjacentElement('afterend', controls);
    const left = 78, right = width - 18, top = 14, bottom = height - 28;
    const format = (v: number | null) => v === null || !Number.isFinite(v) ? 'non enregistré' : v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + unit;
    const render = () => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, width, height);
        first.value = String(view.start); final.value = String(view.end);
        if (!count) { ctx.fillStyle = '#94a3b8'; ctx.font = '12px sans-serif'; ctx.fillText('Aucune donnée enregistrée', 15, 90); readout.textContent = ''; return; }
        let min = Infinity, max = -Infinity;
        for (const row of series) for (let i = view.start; i <= view.end; i++) {
            const value = row.points[i]?.value; if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            min = Math.min(min, value); max = Math.max(max, value);
        }
        if (options.bars) { min = Math.min(min, 0); max = Math.max(max, 0); }
        min = options.min ?? (Number.isFinite(min) ? min : 0); max = options.max ?? (Number.isFinite(max) ? max : 1);
        if (min === max) { const pad = Math.max(1, Math.abs(min) * .05); min -= pad; max += pad; }
        const x = (i: number) => left + (i - view.start) / Math.max(1, view.end - view.start) * (right - left);
        const y = (v: number) => bottom - (v - min) / (max - min) * (bottom - top);
        ctx.font = '10px sans-serif';
        for (let i = 0; i <= 4; i++) {
            const v = min + (max - min) * i / 4, yy = y(v); ctx.strokeStyle = '#334155'; ctx.lineWidth = .5;
            ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(right, yy); ctx.stroke(); ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right';
            const label = Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + ' Md' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + ' M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + ' k' : v.toFixed(1);
            ctx.fillText(label + unit, left - 7, yy + 3);
        }
        ctx.save(); ctx.beginPath(); ctx.rect(left - 5, top - 5, right - left + 10, bottom - top + 10); ctx.clip();
        for (const row of series) {
            ctx.strokeStyle = row.color; ctx.fillStyle = row.color; ctx.lineWidth = 2; ctx.beginPath(); let opened = false;
            for (let i = view.start; i <= view.end; i++) {
                const v = row.points[i]?.value;
                if (typeof v !== 'number' || !Number.isFinite(v)) { opened = false; continue; }
                if (options.bars) { const bw = Math.max(1, Math.min(24, (right - left) / Math.max(1, view.end - view.start + 1) - 2)); ctx.fillStyle = v >= 0 ? row.color : '#ef4444'; ctx.fillRect(x(i) - bw / 2, Math.min(y(0), y(v)), bw, Math.max(1, Math.abs(y(v) - y(0)))); }
                else { if (opened) ctx.lineTo(x(i), y(v)); else ctx.moveTo(x(i), y(v)); opened = true; }
            }
            if (!options.bars) ctx.stroke();
            // Every visible sample remains addressable, even when dots would overlap.
            if (!options.bars && view.end - view.start < 100) for (let i = view.start; i <= view.end; i++) {
                const v = row.points[i]?.value; if (typeof v !== 'number' || !Number.isFinite(v)) continue;
                ctx.beginPath(); ctx.arc(x(i), y(v), 2.5, 0, Math.PI * 2); ctx.fill();
            }
            const value = row.points[view.cursor]?.value;
            if (typeof value === 'number' && Number.isFinite(value)) { ctx.fillStyle = row.color; ctx.beginPath(); ctx.arc(x(view.cursor), y(value), 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
        }
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x(view.cursor), top); ctx.lineTo(x(view.cursor), bottom); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
        ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left'; ctx.fillText(series[0]?.points[view.start]?.time || '', left, height - 8);
        ctx.textAlign = 'right'; ctx.fillText(series[0]?.points[view.end]?.time || '', right, height - 8);
        readout.textContent = `${series[0]?.points[view.cursor]?.time || ''} · ` + series.map(row => `${row.name} : ${format(row.points[view.cursor]?.value ?? null)}`).join(' · ');
    };
    const position = (event: PointerEvent | WheelEvent) => { const rect = canvas.getBoundingClientRect(); return view.start + Math.max(0, Math.min(1, ((event.clientX - rect.left) * width / Math.max(1, rect.width) - left) / Math.max(1, right - left))) * (view.end - view.start); };
    let dragging = false;
    canvas.onpointerdown = event => { if (event.button !== 0) return; dragging = true; view.follow = false; controls.dataset.reInteracting = 'true'; canvas.setPointerCapture?.(event.pointerId); canvas.style.cursor = 'grabbing'; view.cursor = Math.round(position(event)); render(); };
    canvas.onpointermove = event => { if (dragging) { view.cursor = Math.round(position(event)); render(); } };
    const release = () => { dragging = false; delete controls.dataset.reInteracting; canvas.style.cursor = 'grab'; };
    canvas.onpointerup = release; canvas.onpointercancel = release; canvas.onlostpointercapture = release;
    canvas.addEventListener('wheel', event => { if (count < 2) return; event.preventDefault(); view.follow = false; [view.start, view.end] = zoomChartWindow(count, view.start, view.end, position(event), event.deltaY < 0 ? .75 : 1.35); view.cursor = Math.max(view.start, Math.min(view.end, view.cursor)); render(); }, { passive: false });
    canvas.onkeydown = event => { let next = view.cursor; if (event.key === 'ArrowLeft') next--; else if (event.key === 'ArrowRight') next++; else if (event.key === 'Home') next = view.start; else if (event.key === 'End') next = view.end; else return; event.preventDefault(); view.follow = false; view.cursor = Math.max(view.start, Math.min(view.end, next)); render(); };
    first.oninput = () => { view.follow = false; view.start = Math.min(Number(first.value), view.end); view.cursor = Math.max(view.start, view.cursor); render(); };
    final.oninput = () => { view.follow = false; view.end = Math.max(Number(final.value), view.start); view.cursor = Math.min(view.end, view.cursor); render(); };
    reset.onclick = () => { view.follow = false; view.start = 0; view.end = last; render(); };
    live.onclick = () => { view.follow = true; view.start = Math.max(0, last - 287); view.end = last; view.cursor = last; render(); };
    render();
}
