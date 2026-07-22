import { authFetch } from './client';
import type { ChatMember } from './chats';
export type { ChatMember };

export async function getUsers(): Promise<ChatMember[]> {
	const res = await authFetch(`/api/users`);
	if (!res.ok) throw new Error('Failed to fetch users');
	return res.json();
}
