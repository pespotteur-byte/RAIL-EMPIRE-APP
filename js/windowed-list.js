export function windowRange(count, top, height, rowHeight, overscan = 3) {
    count = Math.max(0, Math.floor(count));
    if (!(rowHeight > 0) || !Number.isFinite(rowHeight))
        throw new Error('Invalid row height');
    const start = Math.max(0, Math.min(count, Math.floor(Math.max(0, top) / rowHeight) - overscan));
    const end = Math.max(start, Math.min(count, Math.ceil((Math.max(0, top) + Math.max(rowHeight, height)) / rowHeight) + overscan));
    return { start, end, top: start * rowHeight, bottom: (count - end) * rowHeight };
}
export class WindowedList {
    constructor(host, rowHeight, key, render, nearEnd) {
        this.host = host;
        this.rowHeight = rowHeight;
        this.key = key;
        this.render = render;
        this.nearEnd = nearEnd;
        this.rows = [];
        this.nodes = new Map();
        this.top = document.createElement('div');
        this.body = document.createElement('div');
        this.bottom = document.createElement('div');
        this.frame = 0;
        this.disposed = false;
        this.lastScrollTop = 0;
        this.resize = null;
        this.scroll = () => {
            if (this.frame)
                return;
            this.frame = requestAnimationFrame(() => {
                this.frame = 0;
                if (this.disposed)
                    return;
                const down = this.host.scrollTop > this.lastScrollTop;
                this.lastScrollTop = this.host.scrollTop;
                this.draw();
                if (down && this.host.scrollHeight - this.host.scrollTop - this.host.clientHeight < this.rowHeight * 2)
                    this.nearEnd?.();
            });
        };
        host.replaceChildren(this.top, this.body, this.bottom);
        host.classList.add('re-windowed-list');
        host.tabIndex = 0;
        host.setAttribute('role', 'list');
        this.top.setAttribute('aria-hidden', 'true');
        this.bottom.setAttribute('aria-hidden', 'true');
        host.addEventListener('scroll', this.scroll, { passive: true });
        if (typeof ResizeObserver !== 'undefined') {
            this.resize = new ResizeObserver(() => this.draw());
            this.resize.observe(host);
        }
    }
    setRows(rows, reset = false) {
        if (this.disposed)
            return;
        const index = Math.floor(this.host.scrollTop / this.rowHeight), anchor = this.rows[index];
        const offset = this.host.scrollTop - index * this.rowHeight;
        const oldKey = anchor ? this.key(anchor) : null;
        this.rows = rows;
        if (reset) {
            this.host.scrollTop = 0;
            this.nodes.clear();
        }
        else if (oldKey && this.host.scrollTop > 0) {
            const next = rows.findIndex(row => this.key(row) === oldKey);
            if (next >= 0)
                this.host.scrollTop = next * this.rowHeight + offset;
        }
        this.draw();
    }
    refresh() { this.draw(); }
    draw() {
        if (this.disposed)
            return;
        const range = windowRange(this.rows.length, this.host.scrollTop, this.host.clientHeight || 400, this.rowHeight);
        this.top.style.height = range.top + 'px';
        this.bottom.style.height = range.bottom + 'px';
        const next = new Map(), fragment = document.createDocumentFragment();
        for (let i = range.start; i < range.end; i++) {
            const row = this.rows[i], key = this.key(row), node = this.render(row, this.nodes.get(key));
            node.style.height = this.rowHeight + 'px';
            node.style.boxSizing = 'border-box';
            node.setAttribute('role', 'listitem');
            node.setAttribute('aria-posinset', String(i + 1));
            node.setAttribute('aria-setsize', String(this.rows.length));
            next.set(key, node);
            fragment.appendChild(node);
        }
        this.nodes = next;
        this.body.replaceChildren(fragment);
        this.host.dataset.totalRows = String(this.rows.length);
        this.host.dataset.mountedRows = String(next.size);
    }
    dispose() { this.disposed = true; this.host.removeEventListener('scroll', this.scroll); this.resize?.disconnect(); if (this.frame)
        cancelAnimationFrame(this.frame); this.nodes.clear(); }
}
