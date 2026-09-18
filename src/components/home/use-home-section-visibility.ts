"use client";

import { useCallback, useEffect, useState } from "react";

export function useHomeSectionVisibility(rootMargin = "500px 0px") {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  const sectionRef = useCallback((element: HTMLDivElement | null) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (shouldLoad || !node) return;

    if (!("IntersectionObserver" in window)) {
      const timeoutId = window.setTimeout(() => setShouldLoad(true), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin, shouldLoad]);

  return { sectionRef, shouldLoad };
}
