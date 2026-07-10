import type { ChatDetail } from '$lib/api/chats';

/** Time for same-day messages, short date otherwise. */
export function formatTime(dateStr: string): string {
	const d = new Date(dateStr);
	const now = new Date();
	const sameDay =
		d.getDate() === now.getDate() &&
		d.getMonth() === now.getMonth() &&
		d.getFullYear() === now.getFullYear();
	return sameDay
		? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		: d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Truncated preview of a chat's latest message for the sidebar. */
export function chatPreview(chat: ChatDetail): string {
	const last = chat.last_messages.at(-1);
	if (!last) return 'No messages yet';
	return last.text.length > 44 ? last.text.slice(0, 44) + '…' : last.text;
}

/** Formatted timestamp of a chat's latest message, or '' if none. */
export function chatTime(chat: ChatDetail): string {
	const last = chat.last_messages.at(-1);
	return last ? formatTime(last.created_at) : '';
}
