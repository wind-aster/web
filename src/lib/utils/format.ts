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

/** Human-readable byte size, e.g. 2.4 MB. */
export function formatBytes(bytes: number): string {
	if (!bytes || bytes < 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	const value = bytes / 1024 ** i;
	return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

/** Truncated preview of a chat's latest message for the sidebar. */
export function chatPreview(chat: ChatDetail): string {
	const last = chat.last_messages.at(-1);
	if (!last) return 'No messages yet';
	if (!last.text && last.attachments?.length) {
		const n = last.attachments.length;
		return n > 1 ? `📎 ${n} attachments` : '📎 Attachment';
	}
	return last.text.length > 44 ? last.text.slice(0, 44) + '…' : last.text;
}

/** Formatted timestamp of a chat's latest message, or '' if none. */
export function chatTime(chat: ChatDetail): string {
	const last = chat.last_messages.at(-1);
	return last ? formatTime(last.created_at) : '';
}
