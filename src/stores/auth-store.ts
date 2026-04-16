import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setAuthHandlers } from '../api/client';
import { USE_REAL_API } from '../api/config';
import { mockUser } from '../mock/user';

const REFRESH_TOKEN_KEY = 'noodla_refresh_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  rank: string;
  is_supporter: boolean;
  supporter_since?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string, deviceInfo?: LoginDeviceInfo) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  clearError: () => void;
}

export interface LoginDeviceInfo {
  installation_id: string;
  device_name: string;
  os: 'ios' | 'android';
  os_version: string;
  app_version: string;
}

// Register auth handlers with API client
// This is called lazily to avoid initialization order issues

let handlersRegistered = false;

function ensureHandlers(store: AuthStore) {
  if (handlersRegistered) return;
  handlersRegistered = true;
  setAuthHandlers(
    () => useAuthStore.getState().accessToken,
    () => useAuthStore.getState().refreshToken(),
  );
}

export const useAuthStore = create<AuthStore>((set, get) => {
  // Register auth handlers once store is created
  setTimeout(() => {
    setAuthHandlers(
      () => useAuthStore.getState().accessToken,
      () => useAuthStore.getState().refreshToken(),
    );
  }, 0);

  return {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (email, password, deviceInfo) => {
      set({ isLoading: true, error: null });

      if (!USE_REAL_API) {
        // Mock login
        await new Promise(r => setTimeout(r, 800));
        const user: AuthUser = {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          rank: mockUser.rank,
          is_supporter: mockUser.supporter,
          created_at: mockUser.joinedAt,
        };
        set({ user, accessToken: 'mock-token', isAuthenticated: true, isLoading: false });
        return;
      }

      try {
        const res = await api.post<{
          user: AuthUser & { points_balance: number };
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>('/auth/login', { email, password, device_info: deviceInfo }, { skipAuth: true });

        // Store refresh token in SecureStore (persistent)
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.refresh_token);

        set({
          user: res.user,
          accessToken: res.access_token, // memory only
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err: any) {
        set({ isLoading: false, error: err.message ?? 'ログインに失敗しました' });
        throw err;
      }
    },

    register: async (email, password, name) => {
      set({ isLoading: true, error: null });

      if (!USE_REAL_API) {
        await new Promise(r => setTimeout(r, 1000));
        const user: AuthUser = {
          id: 'mock-user-new',
          email,
          name,
          rank: 'Bronze',
          is_supporter: false,
          created_at: new Date().toISOString(),
        };
        set({ user, accessToken: 'mock-token', isAuthenticated: true, isLoading: false });
        return;
      }

      try {
        const res = await api.post<{
          user: AuthUser;
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>('/auth/register', { email, password, name }, { skipAuth: true });

        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.refresh_token);

        set({
          user: res.user,
          accessToken: res.access_token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err: any) {
        set({ isLoading: false, error: err.message ?? '登録に失敗しました' });
        throw err;
      }
    },

    logout: async () => {
      const { accessToken } = get();

      if (USE_REAL_API && accessToken) {
        try {
          const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
          if (refreshToken) {
            await api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {});
          }
        } catch { /* ignore errors on logout */ }
      }

      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});

      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        error: null,
      });
    },

    refreshToken: async () => {
      if (!USE_REAL_API) return;

      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
      if (!storedRefreshToken) {
        set({ user: null, accessToken: null, isAuthenticated: false });
        throw new Error('No refresh token available');
      }

      try {
        const res = await api.post<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>('/auth/refresh', { refresh_token: storedRefreshToken }, { skipAuth: true });

        // Rotate refresh token
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.refresh_token);

        set({ accessToken: res.access_token });
      } catch {
        // Refresh failed → log out
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
        set({ user: null, accessToken: null, isAuthenticated: false });
        throw new Error('Session expired');
      }
    },

    restoreSession: async (): Promise<boolean> => {
      if (!USE_REAL_API) return false;

      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
      if (!storedRefreshToken) return false;

      try {
        // Refresh token to get new access token
        const res = await api.post<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>('/auth/refresh', { refresh_token: storedRefreshToken }, { skipAuth: true });

        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.refresh_token);
        set({ accessToken: res.access_token });

        // Fetch user info
        const user = await api.get<AuthUser>('/auth/me');
        set({ user, isAuthenticated: true });
        return true;
      } catch {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
        set({ user: null, accessToken: null, isAuthenticated: false });
        return false;
      }
    },

    clearError: () => set({ error: null }),
  };
});
