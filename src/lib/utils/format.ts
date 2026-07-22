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

/** True if two ISO date strings fall on the same calendar day. */
export function sameDay(a: string, b: string): boolean {
	const d1 = new Date(a);
	const d2 = new Date(b);
	return (
		d1.getDate() === d2.getDate() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getFullYear() === d2.getFullYear()
	);
}

/** Date-separator label: "Today" / "Yesterday" / localized date. */
export function formatDaySeparator(dateStr: string): string {
	const d = new Date(dateStr);
	const now = new Date();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (sameDay(dateStr, now.toISOString())) return 'Today';
	if (sameDay(dateStr, yesterday.toISOString())) return 'Yesterday';
	return d.toLocaleDateString([], {
		month: 'long',
		day: 'numeric',
		year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric'
	});
}

/** Relative "last seen" label, e.g. "last seen 5m ago". */
export function formatLastSeen(dateStr?: string): string {
	if (!dateStr) return 'offline';
	const then = new Date(dateStr).getTime();
	if (Number.isNaN(then)) return 'offline';
	const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
	if (secs < 60) return 'last seen just now';
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `last seen ${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `last seen ${hours}h ago`;
	const d = new Date(then);
	const now = new Date();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (sameDay(dateStr, yesterday.toISOString())) return 'last seen yesterday';
	return `last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
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
