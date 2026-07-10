import type { Message } from './chats';

export type MessageHandler = (msg: Message) => void;

const WS_BASE = import.meta.env.VITE_API_URL
	? import.meta.env.VITE_API_URL.replace(/^http/, 'ws')
	: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

let socket: WebSocket | null = null;
let handler: MessageHandler | null = null;
let onReconnected: (() => void) | null = null;
let token: string | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

export function connectWS(
	t: string,
	onMessage: MessageHandler,
	onReconnect?: () => void
): void {
	manualClose = false;
	reconnectAttempts = 0;
	token = t;
	handler = onMessage;
	onReconnected = onReconnect ?? null;
	open();
}

function open(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (!token) return;

	socket = new WebSocket(`${WS_BASE}/api/ws?token=${token}`);

	socket.onopen = () => {
		const recovered = reconnectAttempts > 0;
		reconnectAttempts = 0;
		if (recovered) onReconnected?.();
	};

	socket.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data) as Message;
			handler?.(msg);
		} catch {
			// ignore malformed frames
		}
	};

	socket.onclose = () => {
		socket = null;
		scheduleReconnect();
	};

	socket.onerror = () => {
		// Let onclose drive the retry.
		socket?.close();
	};
}

function scheduleReconnect(): void {
	if (manualClose || token === null) return;
	const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
	reconnectAttempts++;
	reconnectTimer = setTimeout(open, delay);
}

export function sendWS(chatId: number, text: string): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) return false;
	socket.send(JSON.stringify({ chat_id: chatId, text }));
	return true;
}

export function disconnectWS(): void {
	manualClose = true;
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	reconnectAttempts = 0;
	handler = null;
	onReconnected = null;
	token = null;
	socket?.close();
	socket = null;
}
