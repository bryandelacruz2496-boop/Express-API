/**
 * Network-based storage that syncs across devices via the backend API + WebSocket.
 * All devices (phone guests + host dashboard) share the same data.
 */

const API_BASE = `http://${window.location.hostname}:3001`;
const WS_URL = `ws://${window.location.hostname}:3001`;

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
