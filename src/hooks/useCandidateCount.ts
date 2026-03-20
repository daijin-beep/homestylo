"use client";

import { useEffect, useState } from "react";

export const CANDIDATES_STORAGE_KEY = "homestylo_candidates";
export const CANDIDATES_UPDATED_EVENT = "candidates-updated";

function readCandidateCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const rawValue = window.localStorage.getItem(CANDIDATES_STORAGE_KEY);
    if (!rawValue) {
      return 0;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return 0;
    }

    return parsedValue.length;
  } catch {
    return 0;
  }
}

export function useCandidateCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const syncCount = () => {
      setCount(readCandidateCount());
    };

    syncCount();
    window.addEventListener("storage", syncCount);
    window.addEventListener(CANDIDATES_UPDATED_EVENT, syncCount as EventListener);

    return () => {
      window.removeEventListener("storage", syncCount);
      window.removeEventListener(CANDIDATES_UPDATED_EVENT, syncCount as EventListener);
    };
  }, []);

  return { count };
}
