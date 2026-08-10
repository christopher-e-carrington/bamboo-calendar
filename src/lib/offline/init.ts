import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { supabase } from "@/integrations/supabase/client";
import { installOfflineFetch } from "./fetch-interceptor";
import { cleanupOfflineSw, offlineSwAllowed } from "./sw";
import { installChunkRecovery } from "./chunk-recovery";

let initialised = false;

/** Query keys that must never be written to disk. */
const SENSITIVE = ["passwords", "documents"];

export function initOffline(queryClient: QueryClient) {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  installChunkRecovery();

  persistQueryClient({
    queryClient,
    persister: createSyncStoragePersister({
      storage: window.localStorage,
      key: "bamboo:cache:v1",
      throttleTime: 1000,
    }),
    maxAge: 1000 * 60 * 60 * 24 * 7,
    buster: "v1",
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" &&
        !query.queryKey.some((k) => typeof k === "string" && SENSITIVE.includes(k)),
    },
  });

  installOfflineFetch({
    getAuthToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    onSynced: () => void queryClient.invalidateQueries(),
  });

  void cleanupOfflineSw();
  if (offlineSwAllowed() && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* offline shell is best-effort */
    });
  }
}
