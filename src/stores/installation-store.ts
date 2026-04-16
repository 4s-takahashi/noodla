import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const INSTALLATION_ID_KEY = 'noodla_installation_id';

interface InstallationStore {
  installationId: string | null;
  isReady: boolean;
  ensureInstallationId: () => Promise<string>;
}

function generateUUID(): string {
  // RFC 4122 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useInstallationStore = create<InstallationStore>((set, get) => ({
  installationId: null,
  isReady: false,

  ensureInstallationId: async (): Promise<string> => {
    // Return cached value if already loaded
    if (get().installationId) return get().installationId!;

    try {
      // Try to load from SecureStore
      let id = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
      if (!id) {
        // Generate new UUID v4 and persist it
        id = generateUUID();
        await SecureStore.setItemAsync(INSTALLATION_ID_KEY, id);
      }
      set({ installationId: id, isReady: true });
      return id;
    } catch (err) {
      // Fallback for platforms that don't support SecureStore (e.g., web during dev)
      console.warn('SecureStore not available, using in-memory installation ID');
      const id = generateUUID();
      set({ installationId: id, isReady: true });
      return id;
    }
  },
}));
