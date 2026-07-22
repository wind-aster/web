import type { Message, Reaction } from './chats';

export interface WSHandlers {
	onMessage: (msg: Message) => void;
	onMessageUpdated: (msg: Message) => void;
	onMessageDeleted: (chatId: number, messageId: number) => void;
	onMessageReaction: (chatId: number, messageId: number, reactions: Reaction[]) => void;
	onReadStatus: (chatId: number, userId: number, lastRead: number, lastDelivered: number) => void;
	onPresence: (userId: number, online: boolean, lastSeen?: string) => void;
	onTyping: (chatId: number, userId: number, typing: boolean) => void;
}

// Typed envelope pushed by the server. Every realtime frame carries a `type`.
type WSEvent =
	| { type: 'message'; message: Message }
	| { type: 'message_updated'; message: Message }
	| { type: 'message_deleted'; chat_id: number; message_id: number }
	| { type: 'message_reaction'; chat_id: number; message_id: number; reactions: Reaction[] }
	| {
			type: 'read_status';
			chat_id: number;
			user_id: number;
			last_read: number;
			last_delivered: number;
	  }
	| { type: 'presence'; user_id: number; online: boolean; last_seen?: string }
	| { type: 'typing'; chat_id: number; user_id: number; typing: boolean };

const WS_BASE = import.meta.env.VITE_API_URL
	? import.meta.env.VITE_API_URL.replace(/^http/, 'ws')
	: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

type TokenProvider = () => Promise<string | null>;

let socket: WebSocket | null = null;
let handlers: WSHandlers | null = null;
let onReconnected: (() => void) | null = null;
let getToken: TokenProvider | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

export function connectWS(
	provider: TokenProvider,
	wsHandlers: WSHandlers,
	onReconnect?: () => void
): void {
	manualClose = false;
	reconnectAttempts = 0;
	getToken = provider;
	handlers = wsHandlers;
	onReconnected = onReconnect ?? null;
	open();
}

async function open(): Promise<void> {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (!getToken) return;

	// Fetch a fresh access token each (re)connect so rotation doesn't leave us
	// opening the socket with a stale, expired token.
	const token = await getToken();
	if (!token || manualClose) return;

	socket = new WebSocket(`${WS_BASE}/api/ws?token=${token}`);

	socket.onopen = () => {
		const recovered = reconnectAttempts > 0;
		reconnectAttempts = 0;
		if (recovered) onReconnected?.();
	};

	socket.onmessage = (event) => {
		try {
			const ev = JSON.parse(event.data) as WSEvent;
			switch (ev.type) {
				case 'message':
					handlers?.onMessage(ev.message);
					break;
				case 'message_updated':
					handlers?.onMessageUpdated(ev.message);
					break;
				case 'message_deleted':
					handlers?.onMessageDeleted(ev.chat_id, ev.message_id);
					break;
				case 'message_reaction':
					handlers?.onMessageReaction(ev.chat_id, ev.message_id, ev.reactions);
					break;
				case 'read_status':
					handlers?.onReadStatus(ev.chat_id, ev.user_id, ev.last_read, ev.last_delivered);
					break;
				case 'presence':
					handlers?.onPresence(ev.user_id, ev.online, ev.last_seen);
					break;
				case 'typing':
					handlers?.onTyping(ev.chat_id, ev.user_id, ev.typing);
					break;
			}
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
	if (manualClose || getToken === null) return;
	const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
	reconnectAttempts++;
	reconnectTimer = setTimeout(open, delay);
}

export function sendWS(
	chatId: number,
	text: string,
	attachmentIds: number[] = [],
	replyToId?: number
): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) return false;
	socket.send(
		JSON.stringify({
			chat_id: chatId,
			text,
			attachment_ids: attachmentIds,
			reply_to_id: replyToId ?? null
		})
	);
	return true;
}

export function sendTypingWS(chatId: number, typing: boolean): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) return false;
	socket.send(JSON.stringify({ type: 'typing', chat_id: chatId, typing }));
	return true;
}

export function disconnectWS(): void {
	manualClose = true;
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	reconnectAttempts = 0;
	handlers = null;
	onReconnected = null;
	getToken = null;
	socket?.close();
	socket = null;
}
