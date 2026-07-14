import type { Message, Attachment } from './chats';
export type { Message };

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function getMessages(token: string, chatId: number): Promise<Message[]> {
	const res = await fetch(`${API_BASE}/api/messages?chat_id=${chatId}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Failed to fetch messages');
	return res.json();
}

export async function sendMessageRest(
	token: string,
	chatId: number,
	text: string,
	attachmentIds: number[] = []
): Promise<{ message_id: number; created_at: string; attachments?: Attachment[] }> {
	const res = await fetch(`${API_BASE}/api/messages`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ chat_id: chatId, text, attachment_ids: attachmentIds })
	});
	if (!res.ok) throw new Error('Failed to send message');
	return res.json();
}
