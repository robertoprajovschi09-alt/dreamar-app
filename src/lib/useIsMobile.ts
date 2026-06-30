import { useEffect, useState } from "react";

// True on phone-sized / coarse-pointer viewports. Drives the mobile-native shell.
export function useIsMobile(query = "(max-width: 767px)") {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    setMatch(mq.matches);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}
