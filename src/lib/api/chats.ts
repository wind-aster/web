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
}

export interface ChatMember {
	id: number;
	username: string;
	display_name: string;
	email: string;
	created_at: string;
}

export interface ChatDetail {
	id: number;
	title: string;
	type: 'direct' | 'group';
	members: ChatMember[];
	last_messages: Message[];
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
