import { authFetch } from './client';
import type { Message, Attachment } from './chats';
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
	attachmentIds: number[] = []
): Promise<{ message_id: number; created_at: string; attachments?: Attachment[] }> {
	const res = await authFetch(`/api/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId, text, attachment_ids: attachmentIds })
	});
	if (!res.ok) throw new Error('Failed to send message');
	return res.json();
}
