const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface AuthUser {
	id: number;
	username: string;
	email: string;
}

export interface LoginResponse {
	status: string;
	token: string;
	user: AuthUser;
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
	const isEmail = identifier.includes('@');
	const body = isEmail
		? { email: identifier, password }
		: { username: identifier, password };
	const res = await fetch(`${API_BASE}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error((await res.json()).message ?? 'Login failed');
	return res.json();
}

export async function register(
	email: string,
	username: string,
	display_name: string,
	password: string
): Promise<void> {
	const res = await fetch(`${API_BASE}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, username, display_name, password })
	});
	if (!res.ok) throw new Error((await res.json()).message ?? 'Registration failed');
}
