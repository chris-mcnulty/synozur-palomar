import { useMemo } from "react";
import { useSearch } from "wouter";

export function useIsEmbedded(): boolean {
  const searchString = useSearch();
  return useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("embedded") === "true";
  }, [searchString]);
}
