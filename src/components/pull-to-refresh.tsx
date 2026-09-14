"use client";

import { useEffect, useRef, useState } from "react";

const triggerDistance = 72;

function canPullFrom(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable], [role="dialog"], [data-no-pull-refresh]')) {
    return false;
  }

  for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
    const style = window.getComputedStyle(element);
    if (
      /auto|scroll/.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1
    ) {
      return false;
    }
  }
  return true;
}

function isAtTop() {
  return Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop) <= 0;
}

export function PullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulling = false;

    const reset = () => {
      tracking = false;
      pulling = false;
      distanceRef.current = 0;
      if (!refreshingRef.current) setDistance(0);
    };

    const onStart = (event: TouchEvent) => {
      reset();
      if (refreshingRef.current || event.touches.length !== 1 || !isAtTop() || !canPullFrom(event.target)) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking) return;
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;
      if (deltaY <= 8 || deltaY < Math.abs(deltaX) * 1.3 || !isAtTop()) {
        if (deltaY < -8 || Math.abs(deltaX) > 20 || !isAtTop()) reset();
        return;
      }
      if (!event.cancelable) return;
      event.preventDefault();
      pulling = true;
      distanceRef.current = Math.min(96, deltaY * 0.65);
      setDistance(distanceRef.current);
    };

    const onEnd = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        reset();
        return;
      }
      if (pulling && distanceRef.current >= triggerDistance && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setDistance(triggerDistance);
        window.location.reload();
        return;
      }
      reset();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, []);

  if (distance === 0 && !refreshing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-ink shadow-lg"
      style={{
        top: "calc(env(safe-area-inset-top) + 12px)",
        transform: `translate(-50%, ${Math.min(0, distance - triggerDistance)}px)`,
        opacity: Math.min(1, distance / 35),
      }}
    >
      <span aria-hidden="true" className={refreshing ? "inline-block animate-spin text-brand" : "text-brand"}>
        {refreshing ? "◌" : distance >= triggerDistance ? "↑" : "↓"}
      </span>
      {refreshing ? "Atualizando…" : distance >= triggerDistance ? "Solte para atualizar" : "Puxe para atualizar"}
    </div>
  );
}
