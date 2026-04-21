/**
 * queryClient.ts — TanStack Query クライアント singleton
 *
 * Phase 7-A: QueryClient をシングルトンとして管理し、
 * setWsQueryInvalidate() によるコールバック注入を不要にする。
 *
 * app/_layout.tsx で QueryClientProvider に渡し、
 * ws-store.ts から直接 invalidateQueries を呼び出す。
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
