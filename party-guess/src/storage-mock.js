/**
 * Network-based storage that syncs across devices via the backend API + WebSocket.
 * All devices (phone guests + host dashboard) share the same data.
 */

// Talk to the same origin that served the page. In local dev Vite proxies
// /api and /ws to the backend (see vite.config.js); in production the Express
// server serves both the app and the API on one port.
const API_BASE = '';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

// WebSocket for real-time updates
let ws = null;
let listeners = [];

function connectWS() {
    ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'set' || msg.type === 'delete') {
                listeners.forEach((fn) => fn(msg));
            }
        } catch { }
    };
    ws.onclose = () => {
        // Reconnect after 2 seconds
        setTimeout(connectWS, 2000);
    };
    ws.onerror = () => {
        ws.close();
    };
}

connectWS();

window.storageSubscribe = (fn) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter((l) => l !== fn); };
};

window.storage = {
    async get(key) {
        const res = await fetch(`${API_BASE}/api/storage/${encodeURIComponent(key)}`);
        const data = await res.json();
        return data;
    },

    async set(key, value) {
        await fetch(`${API_BASE}/api/storage/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
        });
    },

    async delete(key) {
        await fetch(`${API_BASE}/api/storage/${encodeURIComponent(key)}`, {
            method: 'DELETE',
        });
    },

    async list(prefix) {
        const res = await fetch(`${API_BASE}/api/storage-list/${encodeURIComponent(prefix)}`);
        return await res.json();
    },
};
