"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CANDIDATES_STORAGE_KEY,
  CANDIDATES_UPDATED_EVENT,
} from "@/hooks/useCandidateCount";

interface AddToCandidateButtonProps {
  productId: string;
}

function readCandidateIds() {
  try {
    const rawValue = window.localStorage.getItem(CANDIDATES_STORAGE_KEY);
    if (!rawValue) {
      return [] as string[];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [] as string[];
  }
}

export function AddToCandidateButton({ productId }: AddToCandidateButtonProps) {
  const [isAdded, setIsAdded] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return readCandidateIds().includes(productId);
  });

  useEffect(() => {
    const syncState = () => {
      setIsAdded(readCandidateIds().includes(productId));
    };

    window.addEventListener(CANDIDATES_UPDATED_EVENT, syncState as EventListener);
    window.addEventListener("storage", syncState);

    return () => {
      window.removeEventListener(CANDIDATES_UPDATED_EVENT, syncState as EventListener);
      window.removeEventListener("storage", syncState);
    };
  }, [productId]);

  const handleAdd = () => {
    const ids = readCandidateIds();
    if (ids.includes(productId)) {
      setIsAdded(true);
      return;
    }

    const nextIds = [...ids, productId];
    window.localStorage.setItem(CANDIDATES_STORAGE_KEY, JSON.stringify(nextIds));
    window.dispatchEvent(new Event(CANDIDATES_UPDATED_EVENT));
    setIsAdded(true);
  };

  return (
    <Button
      type="button"
      onClick={handleAdd}
      disabled={isAdded}
      className="h-12 w-full text-base md:w-[280px]"
      variant={isAdded ? "secondary" : "default"}
    >
      {isAdded ? (
        <>
          <Check className="h-4 w-4" />
          {"\u5df2\u52a0\u5165 \u2713"}
        </>
      ) : (
        "\u52a0\u5165\u5019\u9009\u6e05\u5355"
      )}
    </Button>
  );
}
