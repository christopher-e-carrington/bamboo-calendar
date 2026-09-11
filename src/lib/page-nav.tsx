import { createContext, useContext } from "react";

type NavFn = (page: string) => void;

const PageNavContext = createContext<NavFn>(() => {});

export function PageNavProvider({ navigate, children }: { navigate: NavFn; children: React.ReactNode }) {
  return <PageNavContext.Provider value={navigate}>{children}</PageNavContext.Provider>;
}

export function usePageNav() {
  return useContext(PageNavContext);
}
