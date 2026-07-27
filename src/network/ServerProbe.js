const RESULT_TTL_MS = 15000;

const PROBE_TIMEOUT_MS = 4000;

export function latencyTier(rttMs) {
    if (rttMs == null) return 'offline';
    if (rttMs < 60) return 'good';
    if (rttMs < 120) return 'ok';
    if (rttMs < 200) return 'high';
    return 'bad';
}

class ServerProbeManager {
    constructor() {
        this.results = new Map();
        this.inFlight = new Map();
        this.liveSockets = new Set();
        this.pendingCancels = new Set();
        this.locked = false;
    }

    getResult(serverId) {
        return this.results.get(serverId) ?? null;
    }

    isFresh(serverId) {
        const r = this.results.get(serverId);
        return !!r && (Date.now() - r.measuredAt) < RESULT_TTL_MS;
    }

    lock() {
        this.locked = true;
        this.closeAll();
    }

    unlock() {
        this.locked = false;
    }

    closeAll() {
        for (const cancel of [...this.pendingCancels]) cancel();
        this.pendingCancels.clear();

        for (const ws of this.liveSockets) {
            try {
                ws.onopen = null;
                ws.onerror = null;
                ws.onclose = null;
                ws.onmessage = null;
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            } catch (_) { /* zaten kapali */ }
        }
        this.liveSockets.clear();
    }

    /**
     * Tek bir sunucuyu olcer.
     *
     * @param {{id:string, wsUrl:string}} server
     * @param {{force?:boolean}} [opts] force=true TTL'i yok sayar (Refresh dugmesi).
     * @returns {Promise<{rttMs:number|null, online:boolean, measuredAt:number}>}
     */
    probe(server, { force = false } = {}) {
        const cached = this.results.get(server.id);

        // 1) Kilitliyken (oyun ici) asla yeni soket acma — bilinen degeri dondur.
        if (this.locked) {
            return Promise.resolve(cached ?? { rttMs: null, online: false, measuredAt: 0 });
        }

        // 2) TTL icindeyse onbellekten servis et — UI tiklamasi soket ACMAZ.
        if (!force && this.isFresh(server.id)) {
            return Promise.resolve(cached);
        }

        // 3) Ayni sunucu icin zaten bir olcum ucusta ise ONA katil (soket cogaltma).
        const pending = this.inFlight.get(server.id);
        if (pending) return pending;

        const task = this._openProbeSocket(server)
            .then((result) => {
                // Iptal edilen olcum SONUC YAZMAZ: yalnizca kesildigi icin
                // saglikli bir sunucuyu "offline" diye onbellege almayalim.
                if (result.cancelled) {
                    return this.results.get(server.id)
                        ?? { rttMs: null, online: false, measuredAt: 0 };
                }
                this.results.set(server.id, result);
                return result;
            })
            .finally(() => {
                this.inFlight.delete(server.id);
            });

        this.inFlight.set(server.id, task);
        return task;
    }

    /**
     * Olcum soketini acar. RTT, el sikismasi suresinin YARISIDIR: handshake
     * kabaca TCP kurulumu (1 RTT) + WS upgrade (1 RTT) icerir.
     */
    _openProbeSocket(server) {
        return new Promise((resolve) => {
            const url = normalizeWsUrl(server.wsUrl);
            let ws = null;
            let settled = false;
            const t0 = performance.now();

            const settle = (online, cancelled = false) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                this.pendingCancels.delete(cancel);

                if (ws) {
                    // Dinleyicileri kapatmadan ONCE sok.
                    ws.onopen = null;
                    ws.onerror = null;
                    ws.onclose = null;
                    this.liveSockets.delete(ws);
                    try { ws.close(); } catch (_) { /* zaten kapali */ }
                }

                if (cancelled) {
                    resolve({ cancelled: true });
                    return;
                }

                resolve({
                    rttMs: online ? Math.max(1, Math.round((performance.now() - t0) / 2)) : null,
                    online,
                    measuredAt: Date.now(),
                });
            };

            const cancel = () => settle(false, true);
            this.pendingCancels.add(cancel);

            const timeoutId = setTimeout(() => settle(false), PROBE_TIMEOUT_MS);

            try {
                ws = new WebSocket(url);
                this.liveSockets.add(ws);
                ws.onopen = () => settle(true);
                ws.onerror = () => settle(false);
                ws.onclose = () => settle(false);
            } catch (_) {
                settle(false);
            }
        });
    }

    /**
     * Tum sunuculari olcer (onbellek/ucus kurallari probe() icinde uygulanir).
     * @returns {Promise<Map<string, {rttMs:number|null, online:boolean}>>}
     */
    async probeAll(servers, opts) {
        const entries = await Promise.all(
            servers.map(async (s) => [s.id, await this.probe(s, opts)]),
        );
        return new Map(entries);
    }

    /**
     * En dusuk gecikmeli CEVRIMICI sunucu; hicbiri cevrimici degilse null.
     */
    pickLowestLatency(servers) {
        let best = null;
        let bestRtt = Infinity;
        for (const server of servers) {
            const r = this.results.get(server.id);
            if (!r || !r.online || r.rttMs == null) continue;
            if (r.rttMs < bestRtt) {
                bestRtt = r.rttMs;
                best = server;
            }
        }
        return best;
    }
}

/** Sunucu WS endpoint'i /ws path'inde yasar — normalize et. */
export function normalizeWsUrl(rawUrl) {
    return rawUrl.endsWith('/ws') ? rawUrl : rawUrl.replace(/\/+$/, '') + '/ws';
}

/** Uygulama genelinde TEK ornek (singleton). */
export const serverProbe = new ServerProbeManager();
