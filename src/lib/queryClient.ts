import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh
      staleTime: 1000 * 60 * 5, // 5 minutes
      // Cache time: how long data stays in cache after component unmounts
      gcTime: 1000 * 60 * 30, // 30 minutes (was cacheTime in v4)
      // Retry failed requests
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except for 429 (rate limit)
        if (error && typeof error === "object" && "status" in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500 && status !== 429) {
            return false;
          }
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      // Refetch on window focus for important data
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});
