import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string) {
  const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  };
  const getSnapshot = () => window.matchMedia(query).matches;
  return useSyncExternalStore<boolean | undefined>(subscribe, getSnapshot, () => undefined);
}
