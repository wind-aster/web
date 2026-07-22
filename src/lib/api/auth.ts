const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface AuthUser {
	id: number;
	username: string;
	email: string;
}

export interface LoginResponse {
	status: string;
	access_token: string;
	refresh_token: string;
	user: AuthUser;
}

export interface RefreshResponse {
	access_token: string;
	refresh_token: string;
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
	const isEmail = identifier.includes('@');
	const body = isEmail ? { email: identifier, password } : { username: identifier, password };
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

// Rotate a refresh token for a new access + refresh pair. Bypasses authFetch to
// avoid recursion (this is what authFetch calls on a 401).
export async function refresh(refreshToken: string): Promise<RefreshResponse> {
	const res = await fetch(`${API_BASE}/api/refresh`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refresh_token: refreshToken })
	});
	if (!res.ok) throw new Error('Refresh failed');
	return res.json();
}

// Revoke a refresh token server-side. Best-effort; errors are ignored by callers.
export async function logout(refreshToken: string): Promise<void> {
	await fetch(`${API_BASE}/api/logout`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refresh_token: refreshToken })
	});
}
