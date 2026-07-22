import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { auth } from '$lib/stores/auth.svelte';
import { refresh as apiRefresh } from '$lib/api/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Single-flight guard: concurrent 401s share one refresh round-trip.
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
	const rt = auth.refreshToken;
	if (!rt) return null;
	try {
		const res = await apiRefresh(rt);
		auth.setTokens(res.access_token, res.refresh_token);
		return res.access_token;
	} catch {
		return null;
	}
}

function refreshAccess(): Promise<string | null> {
	if (!refreshPromise) {
		refreshPromise = doRefresh().finally(() => {
			refreshPromise = null;
		});
	}
	return refreshPromise;
}

function forceLogout() {
	auth.logout();
	if (browser) goto(resolve('/login'), { replaceState: true });
}

// authFetch attaches the current access token and, on a 401, transparently
// refreshes it once and retries. If the refresh itself fails, the session is
// cleared and the user is sent to /login.
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const send = (token: string | null) => {
		const headers = new Headers(init.headers);
		if (token) headers.set('Authorization', `Bearer ${token}`);
		return fetch(`${API_BASE}${path}`, { ...init, headers });
	};

	let res = await send(auth.token);
	if (res.status !== 401) return res;

	const newToken = await refreshAccess();
	if (!newToken) {
		forceLogout();
		return res;
	}
	res = await send(newToken);
	if (res.status === 401) forceLogout();
	return res;
}

function tokenExp(token: string): number | null {
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return typeof payload.exp === 'number' ? payload.exp : null;
	} catch {
		return null;
	}
}

// ensureFreshAccess returns a usable access token, proactively refreshing when
// it is missing or within ~30s of expiry. Used before (re)opening the WebSocket
// so reconnects carry a valid token after rotation.
export async function ensureFreshAccess(): Promise<string | null> {
	const token = auth.token;
	const exp = token ? tokenExp(token) : null;
	if (token && exp !== null && exp * 1000 - Date.now() > 30_000) return token;
	return refreshAccess();
}
