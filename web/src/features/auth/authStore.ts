import { create } from 'zustand';
import axios from 'axios';

interface Agent {
	id: string;
	email: string;
	name: string;
	emailVerified?: boolean;
	teamId?: string | null;
	brokerageId?: string | null;
}

interface AuthState {
	token: string | null;
	refreshToken: string | null;
	agent: Agent | null;
	emailVerified: boolean;
	login: (email: string, password: string) => Promise<void>;
	demoLogin: () => Promise<void>;
	devLogin: (email?: string) => Promise<void>;
	signup: (input: { name?: string; email: string; password: string; acceptTerms: true; acceptPrivacy: true }) => Promise<void>;
	loadAgent: () => Promise<void>;
	refreshSession: () => Promise<boolean>;
	logout: () => void;
	setEmailVerified: (verified: boolean) => void;
}

const firstLoginWelcomeKey = (agentId: string) => `aep_first_login_welcome_${agentId}`;

const readStoredRefreshToken = (): string | null => {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return null;
	}
	try {
		const token = localStorage.getItem('utahcontracts_refresh_token');
		if (!token || token === 'null' || token === 'undefined') return null;
		return token;
	} catch {
		return null;
	}
};

const persistSessionTokens = (token: string, refreshToken?: string | null) => {
	localStorage.setItem('utahcontracts_token', token);
	if (refreshToken && typeof refreshToken === 'string') {
		localStorage.setItem('utahcontracts_refresh_token', refreshToken);
	}
};

const readStoredToken = (): string | null => {
	// Safely check for browser environment
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return null;
	}
	try {
		const token = localStorage.getItem('utahcontracts_token');
		if (!token || token === 'null' || token === 'undefined') return null;
		return token;
	} catch (e) {
		// localStorage may be blocked (privacy mode, etc.)
		console.warn('localStorage access failed:', e);
		return null;
	}
};

export const useAuthStore = create<AuthState>((set) => ({
	token: readStoredToken(),
	refreshToken: readStoredRefreshToken(),
	agent: null,
	emailVerified: true, // default true until we know otherwise (existing users)
	async login(email: string, password: string) {
		const res = await axios.post('/api/auth/login', { email, password });
		const { token, refreshToken, agent, emailVerified } = res.data;
		if (!token || typeof token !== 'string') {
			throw new Error('Login failed: missing token');
		}
		persistSessionTokens(token, refreshToken);
		set({ token, refreshToken: refreshToken ?? null, agent, emailVerified: emailVerified ?? true });
	},
	async demoLogin() {
		const isDev = Boolean((import.meta as any)?.env?.DEV);
		try {
			if (isDev) {
				const res = await axios.post('/api/auth/dev-login', { email: 'demo@agentease.com' });
				const { token, agent } = res.data;
				if (!token || typeof token !== 'string') {
					throw new Error('Dev login failed: missing token');
				}
				persistSessionTokens(token, null);
				set({ token, refreshToken: null, agent });
				return;
			}

			const res = await axios.post('/api/auth/demo-login');
			const { token, agent } = res.data;
			if (!token || typeof token !== 'string') {
				throw new Error('Demo login failed: missing token');
			}
			persistSessionTokens(token, null);
			set({ token, refreshToken: null, agent });
		} catch (err) {
			if (!isDev) {
				throw err;
			}

			const res = await axios.post('/api/auth/dev-login', { email: 'demo@agentease.com' });
			const { token, agent } = res.data;
			if (!token || typeof token !== 'string') {
				throw new Error('Dev login failed: missing token');
			}
			persistSessionTokens(token, null);
			set({ token, refreshToken: null, agent });
		}
	},
	async devLogin(email?: string) {
		const res = await axios.post('/api/auth/dev-login', { email: email || 'demo@agentease.com' });
		const { token, agent } = res.data;
		if (!token || typeof token !== 'string') {
			throw new Error('Dev login failed: missing token');
		}
		persistSessionTokens(token, null);
		set({ token, refreshToken: null, agent });
	},
	async signup(input: { name?: string; email: string; password: string; acceptTerms: true; acceptPrivacy: true }) {
		const res = await axios.post('/api/auth/signup', input);
		const { token, refreshToken, agent, emailVerified } = res.data;
		if (!token || typeof token !== 'string') {
			throw new Error('Signup failed: missing token');
		}
		persistSessionTokens(token, refreshToken);
		if (agent?.id) {
			localStorage.setItem(firstLoginWelcomeKey(agent.id), '1');
		}
		set({ token, refreshToken: refreshToken ?? null, agent, emailVerified: emailVerified ?? false });
	},
	async loadAgent() {
		const token = readStoredToken();
		if (!token) return;
		try {
			set({ token });
			const res = await axios.get('/api/agents/me', {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.data?.agent) {
				const agent = res.data.agent;
				set({ agent, emailVerified: agent.emailVerified ?? true });
			}
		} catch {
			// If token is invalid, api.ts interceptor will also clear it on next API call.
		}
	},
	async refreshSession() {
		const currentRefresh = readStoredRefreshToken();
		if (!currentRefresh) return false;
		try {
			const res = await axios.post('/api/auth/refresh', { refreshToken: currentRefresh });
			const token = res.data?.token;
			const nextRefresh = res.data?.refreshToken;
			const agent = res.data?.agent;
			if (!token || typeof token !== 'string') {
				return false;
			}
			persistSessionTokens(token, nextRefresh ?? currentRefresh);
			set({
				token,
				refreshToken: (nextRefresh ?? currentRefresh) as string,
				agent: agent ?? useAuthStore.getState().agent,
			});
			return true;
		} catch {
			return false;
		}
	},
	logout() {
		localStorage.removeItem('utahcontracts_token');
		localStorage.removeItem('utahcontracts_refresh_token');
		set({ token: null, refreshToken: null, agent: null, emailVerified: true });
	},
	setEmailVerified(verified: boolean) {
		set({ emailVerified: verified });
	},
}));
