import type { ChatMember } from './chats';
export type { ChatMember };

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function getUsers(token: string): Promise<ChatMember[]> {
	const res = await fetch(`${API_BASE}/api/users`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Failed to fetch users');
	return res.json();
}
