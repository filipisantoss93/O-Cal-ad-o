"use client";

import type { ReactNode } from "react";
import { isValidElement, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  XIcon,
} from "@/components/icons";

type FloatingNoticeProps = {
  tone: "success" | "error";
  children: ReactNode;
  durationMs?: number | null;
};

function contentKey(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(contentKey).join("|");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return contentKey(node.props.children);
  }
  return "";
}

export function FloatingNotice({
  tone,
  children,
  durationMs,
}: FloatingNoticeProps) {
  const noticeKey = `${tone}:${contentKey(children)}`;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const timeout =
    durationMs === undefined
      ? tone === "success"
        ? 7_000
        : 10_000
      : durationMs;

  useEffect(() => {
    if (timeout === null || timeout <= 0) return;

    const timer = window.setTimeout(
      () => setDismissedKey(noticeKey),
      timeout,
    );
    return () => window.clearTimeout(timer);
  }, [noticeKey, timeout]);

  if (
    dismissedKey === noticeKey ||
    children === null ||
    children === undefined ||
    children === false
  ) {
    return null;
  }

  const success = tone === "success";
  const Icon = success ? CheckIcon : AlertTriangleIcon;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[200] flex justify-center px-3 sm:top-4 sm:px-6">
      <div
        role={success ? "status" : "alert"}
        aria-live={success ? "polite" : "assertive"}
        aria-atomic="true"
        className={`pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-2xl border bg-white p-4 shadow-[0_18px_48px_rgba(23,35,33,0.24)] ${
          success
            ? "border-positive/25 text-positive"
            : "border-brand/25 text-brand-dark"
        }`}
      >
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl ${
            success ? "bg-positive-soft" : "bg-brand/10"
          }`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pt-1 text-sm font-bold leading-6">
          {children}
        </div>
        <button
          type="button"
          onClick={() => setDismissedKey(noticeKey)}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-current transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Fechar aviso"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
