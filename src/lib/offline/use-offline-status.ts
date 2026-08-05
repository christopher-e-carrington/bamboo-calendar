import { useEffect, useState } from "react";
import { getOfflineState, subscribeOffline, type OfflineState } from "./queue";

export function useOfflineStatus(): OfflineState {
  const [state, setState] = useState<OfflineState>({ online: true, pending: 0, syncing: false });

  useEffect(() => {
    setState(getOfflineState());
    const unsubscribe = subscribeOffline(setState);
    const sync = () => setState(getOfflineState());
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      unsubscribe();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return state;
}
