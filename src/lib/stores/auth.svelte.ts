import { browser } from '$app/environment';
import type { AuthUser } from '$lib/api/auth';

const ACCESS_KEY = 'windaster_access';
const REFRESH_KEY = 'windaster_refresh';
const USER_KEY = 'windaster_user';

function getUserIdFromToken(token: string): number | null {
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return typeof payload.user_id === 'number' ? payload.user_id : null;
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
	let accessToken = $state<string | null>(browser ? localStorage.getItem(ACCESS_KEY) : null);
	let refreshToken = $state<string | null>(browser ? localStorage.getItem(REFRESH_KEY) : null);
	let user = $state<AuthUser | null>(loadStoredUser());

	// A session is only valid if we hold a refresh token — pre-Batch-B sessions
	// (access token only) are treated as logged out and must re-login once.
	if (browser && !refreshToken) {
		accessToken = null;
		user = null;
	}

	return {
		get token() {
			return accessToken;
		},
		get refreshToken() {
			return refreshToken;
		},
		get user() {
			return user;
		},
		get userId(): number | null {
			return user?.id ?? (accessToken ? getUserIdFromToken(accessToken) : null);
		},
		get isAuthenticated() {
			return accessToken !== null && refreshToken !== null;
		},
		login(access: string, refresh: string, newUser: AuthUser) {
			accessToken = access;
			refreshToken = refresh;
			user = newUser;
			if (browser) {
				localStorage.setItem(ACCESS_KEY, access);
				localStorage.setItem(REFRESH_KEY, refresh);
				localStorage.setItem(USER_KEY, JSON.stringify(newUser));
			}
		},
		setTokens(access: string, refresh: string) {
			accessToken = access;
			refreshToken = refresh;
			if (browser) {
				localStorage.setItem(ACCESS_KEY, access);
				localStorage.setItem(REFRESH_KEY, refresh);
			}
		},
		logout() {
			accessToken = null;
			refreshToken = null;
			user = null;
			if (browser) {
				localStorage.removeItem(ACCESS_KEY);
				localStorage.removeItem(REFRESH_KEY);
				localStorage.removeItem(USER_KEY);
			}
		}
	};
}

export const auth = createAuthStore();
