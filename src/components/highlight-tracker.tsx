"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import {
  recordHighlightEvent,
  type HighlightEventType,
} from "@/lib/highlights-client";

type HighlightTrackerProps = {
  campaignId: number | null;
  children: ReactNode;
};

const trackedEvents = new Set<HighlightEventType>([
  "whatsapp",
  "directions",
]);

export function HighlightTracker({
  campaignId,
  children,
}: HighlightTrackerProps) {
  useEffect(() => {
    recordHighlightEvent([campaignId], "store_view");
  }, [campaignId]);

  function trackInteraction(event: MouseEvent<HTMLDivElement>) {
    const element = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-highlight-event]",
    );
    const eventType = element?.dataset.highlightEvent as
      | HighlightEventType
      | undefined;
    if (eventType && trackedEvents.has(eventType)) {
      recordHighlightEvent([campaignId], eventType);
    }
  }

  return <div onClickCapture={trackInteraction}>{children}</div>;
}
