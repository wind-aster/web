const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface Message {
	id: number;
	sender_id: number;
	chat_id: number;
	text: string;
	created_at: string;
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

export async function getChats(token: string): Promise<ChatDetail[]> {
	const res = await fetch(`${API_BASE}/api/chats`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Failed to fetch chats');
	return res.json();
}

export async function createChat(
	token: string,
	title: string,
	type: 'direct' | 'group',
	memberIds: number[]
): Promise<number> {
	const res = await fetch(`${API_BASE}/api/chats`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ title, type, member_ids: memberIds })
	});
	if (!res.ok) throw new Error('Failed to create chat');
	const data = await res.json();
	return data.chat_id;
}
