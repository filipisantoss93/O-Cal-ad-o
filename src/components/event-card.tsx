import Image from "next/image";
import Link from "next/link";
import { eventCategoryName, eventDate, eventPrice, type EventRecord } from "@/lib/events";

export function EventCard({ event, imageUrl, organizer, location }: {
  event: EventRecord; imageUrl: string; organizer: string; location: string;
}) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <Link href={"/eventos/" + event.id} className="group flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-brand">
        <div className="relative aspect-video overflow-hidden bg-canvas">
          <Image src={imageUrl} alt={"Banner de " + event.title} fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover transition group-hover:scale-[1.02]" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-brand-dark">
            {eventCategoryName(event.category)}
          </p>
          <h2 className="line-clamp-2 text-sm font-black leading-5 text-ink sm:text-lg">
            {event.title}
          </h2>
          <p className="text-xs font-bold text-muted sm:text-sm">{eventDate(event.starts_at, event.utc_offset)}</p>
          <p className="line-clamp-2 text-xs text-muted sm:text-sm">{event.venue_name} · {location}</p>
          <p className="mt-auto pt-1 text-sm font-black text-brand-dark">{eventPrice(event.free_entry, event.ticket_price_cents)}</p>
          <p className="truncate text-[11px] font-semibold text-muted">Por {organizer}</p>
        </div>
      </Link>
    </article>
  );
}
