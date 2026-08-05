import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data instantly and keep it around for offline use.
        networkMode: "offlineFirst",
        gcTime: 1000 * 60 * 60 * 24 * 7,
        staleTime: 1000 * 30,
        retry: 1,
      },
      mutations: {
        // Let writes run even when the browser reports no connection: the
        // offline queue captures them and replays them on reconnect.
        networkMode: "offlineFirst",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
