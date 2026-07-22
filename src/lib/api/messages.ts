import { authFetch } from './client';
import type { Message, Attachment, ReplyPreview, Reaction } from './chats';
export type { Message };

export async function getMessages(chatId: number, limit = 50, before?: number): Promise<Message[]> {
	const params = new URLSearchParams({ chat_id: String(chatId), limit: String(limit) });
	if (before !== undefined) params.set('before', String(before));
	const res = await authFetch(`/api/messages?${params}`);
	if (!res.ok) throw new Error('Failed to fetch messages');
	return res.json();
}

export async function sendMessageRest(
	chatId: number,
	text: string,
	attachmentIds: number[] = [],
	replyToId?: number
): Promise<{
	message_id: number;
	created_at: string;
	attachments?: Attachment[];
	reply_preview?: ReplyPreview;
}> {
	const res = await authFetch(`/api/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			attachment_ids: attachmentIds,
			reply_to_id: replyToId ?? null
		})
	});
	if (!res.ok) throw new Error('Failed to send message');
	return res.json();
}

export async function editMessage(id: number, text: string): Promise<Message> {
	const res = await authFetch(`/api/messages/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text })
	});
	if (!res.ok) throw new Error('Failed to edit message');
	return res.json();
}

export async function deleteMessage(id: number): Promise<void> {
	const res = await authFetch(`/api/messages/${id}`, { method: 'DELETE' });
	if (!res.ok) throw new Error('Failed to delete message');
}

export async function toggleReaction(
	id: number,
	emoji: string
): Promise<{ reactions: Reaction[] }> {
	const res = await authFetch(`/api/messages/${id}/reactions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ emoji })
	});
	if (!res.ok) throw new Error('Failed to toggle reaction');
	return res.json();
}
