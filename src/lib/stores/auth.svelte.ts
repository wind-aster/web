import { browser } from '$app/environment';
import type { AuthUser } from '$lib/api/auth';

const TOKEN_KEY = 'windaster_token';
const USER_KEY = 'windaster_user';

function getUserIdFromToken(token: string): number | null {
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return typeof payload.UserID === 'number' ? payload.UserID : null;
	} catch {
		return null;
	}
}

function loadStoredUser(): AuthUser | null {
	if (!browser) return null;
	try {
		const s = localStorage.getItem(USER_KEY);
		return s ? (JSON.parse(s) as AuthUser) : null;
	} catch {
		return null;
	}
}

function createAuthStore() {
	let token = $state<string | null>(browser ? localStorage.getItem(TOKEN_KEY) : null);
	let user = $state<AuthUser | null>(loadStoredUser());

	return {
		get token() {
			return token;
		},
		get user() {
			return user;
		},
		get userId(): number | null {
			return user?.id ?? (token ? getUserIdFromToken(token) : null);
		},
		get isAuthenticated() {
			return token !== null;
		},
		login(newToken: string, newUser: AuthUser) {
			token = newToken;
			user = newUser;
			if (browser) {
				localStorage.setItem(TOKEN_KEY, newToken);
				localStorage.setItem(USER_KEY, JSON.stringify(newUser));
			}
		},
		logout() {
			token = null;
			user = null;
			if (browser) {
				localStorage.removeItem(TOKEN_KEY);
				localStorage.removeItem(USER_KEY);
			}
		}
	};
}

export const auth = createAuthStore();
