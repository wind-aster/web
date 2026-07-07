import type { Message } from './chats';

export type MessageHandler = (msg: Message) => void;

const WS_BASE = import.meta.env.VITE_API_URL
	? import.meta.env.VITE_API_URL.replace(/^http/, 'ws')
	: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

let socket: WebSocket | null = null;
let handler: MessageHandler | null = null;

export function connectWS(token: string, onMessage: MessageHandler): void {
	disconnectWS();
	handler = onMessage;
	socket = new WebSocket(`${WS_BASE}/api/ws?token=${token}`);

	socket.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data) as Message;
			handler?.(msg);
		} catch {
			// ignore malformed frames
		}
	};

	socket.onerror = () => {
		socket = null;
	};
	socket.onclose = () => {
		socket = null;
	};
}

export function sendWS(chatId: number, text: string): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) return false;
	socket.send(JSON.stringify({ chat_id: chatId, text }));
	return true;
}

export function disconnectWS(): void {
	socket?.close();
	socket = null;
	handler = null;
}
