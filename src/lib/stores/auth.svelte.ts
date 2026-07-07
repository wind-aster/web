import { browser } from '$app/environment';
import type { AuthUser } from '$lib/api/auth';

const TOKEN_KEY = 'windaster_token';

function createAuthStore() {
	let token = $state<string | null>(browser ? localStorage.getItem(TOKEN_KEY) : null);
	let user = $state<AuthUser | null>(null);

	return {
		get token() {
			return token;
		},
		get user() {
			return user;
		},
		get isAuthenticated() {
			return token !== null;
		},
		login(newToken: string, newUser: AuthUser) {
			token = newToken;
			user = newUser;
			if (browser) localStorage.setItem(TOKEN_KEY, newToken);
		},
		logout() {
			token = null;
			user = null;
			if (browser) localStorage.removeItem(TOKEN_KEY);
		}
	};
}

export const auth = createAuthStore();
