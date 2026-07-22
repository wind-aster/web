import { authFetch } from './client';

export interface Attachment {
	id: number;
	filename: string;
	mime_type: string;
	size_bytes: number;
	width?: number;
	height?: number;
	url: string;
	thumb_url?: string;
}

export interface ReplyPreview {
	id: number;
	sender_name: string;
	text: string;
}

export interface Reaction {
	emoji: string;
	count: number;
	user_ids: number[];
}

export interface Message {
	id: number;
	sender_id: number;
	chat_id: number;
	text: string;
	created_at: string;
	attachments?: Attachment[];
	reply_to_id?: number;
	edited_at?: string;
	reply_preview?: ReplyPreview;
	reactions?: Reaction[];
}

export interface ChatMember {
	id: number;
	username: string;
	display_name: string;
	email: string;
	created_at: string;
	online?: boolean;
	last_seen?: string;
}

export interface MemberStatus {
	user_id: number;
	last_read: number;
	last_delivered: number;
}

export interface ChatDetail {
	id: number;
	title: string;
	type: 'direct' | 'group';
	members: ChatMember[];
	last_messages: Message[];
	unread_count: number;
	member_status: MemberStatus[];
}

export async function getChats(): Promise<ChatDetail[]> {
	const res = await authFetch(`/api/chats`);
	if (!res.ok) throw new Error('Failed to fetch chats');
	return res.json();
}

export async function createChat(
	title: string,
	type: 'direct' | 'group',
	memberIds: number[]
): Promise<number> {
	const res = await authFetch(`/api/chats`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title, type, member_ids: memberIds })
	});
	if (!res.ok) throw new Error('Failed to create chat');
	const data = await res.json();
	return data.chat_id;
}

export async function markChatRead(chatId: number, messageId: number): Promise<void> {
	const res = await authFetch(`/api/chats/${chatId}/read`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message_id: messageId })
	});
	if (!res.ok) throw new Error('Failed to mark chat read');
}
