import { useEffect, useState } from "react";

/** Simulates an initial data fetch so loading skeletons are demonstrable. */
export function useFakeLoad(ms = 650) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}
