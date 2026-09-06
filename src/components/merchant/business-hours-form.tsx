"use client";

import { useActionState, useState } from "react";
import { saveBusinessHoursAction } from "@/app/painel/loja/actions";
import { initialActionState } from "@/lib/action-state";

export type BusinessHourValue = {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

type DaySchedule = {
  weekday: number;
  label: string;
  shortLabel: string;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

const days = [
  { weekday: 1, label: "Segunda-feira", shortLabel: "Seg" },
  { weekday: 2, label: "Terça-feira", shortLabel: "Ter" },
  { weekday: 3, label: "Quarta-feira", shortLabel: "Qua" },
  { weekday: 4, label: "Quinta-feira", shortLabel: "Qui" },
  { weekday: 5, label: "Sexta-feira", shortLabel: "Sex" },
  { weekday: 6, label: "Sábado", shortLabel: "Sáb" },
  { weekday: 0, label: "Domingo", shortLabel: "Dom" },
] as const;

function isAlwaysOpen(hours: BusinessHourValue[]) {
  return (
    hours.length === 7 &&
    hours.every(
      (hour) =>
        !hour.isClosed &&
        hour.opensAt?.startsWith("00:00") &&
        hour.closesAt?.startsWith("23:59"),
    )
  );
}

function initialSchedule(hours: BusinessHourValue[]): DaySchedule[] {
  const byWeekday = new Map(hours.map((hour) => [hour.weekday, hour]));
  return days.map((day) => {
    const saved = byWeekday.get(day.weekday);
    const saturday = day.weekday === 6;
    const sunday = day.weekday === 0;
    return {
      ...day,
      opensAt: saved?.opensAt?.slice(0, 5) ?? "08:00",
      closesAt: saved?.closesAt?.slice(0, 5) ?? (saturday ? "12:00" : "18:00"),
      isClosed: saved?.isClosed ?? sunday,
    };
  });
}

export function BusinessHoursForm({ hours }: { hours: BusinessHourValue[] }) {
  const [state, action, pending] = useActionState(
    saveBusinessHoursAction,
    initialActionState,
  );
  const [alwaysOpen, setAlwaysOpen] = useState(() => isAlwaysOpen(hours));
  const [schedule, setSchedule] = useState(() => initialSchedule(hours));

  function updateDay(weekday: number, update: Partial<DaySchedule>) {
    setSchedule((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...update } : day,
      ),
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state.message && (
        <div
          role={state.status === "success" ? "status" : "alert"}
          className={
            state.status === "success"
              ? "rounded-xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold text-positive"
              : "rounded-xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold text-brand-dark"
          }
        >
          {state.message}
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-accent-dark/15 bg-accent/20 p-4">
        <input
          className="mt-1 size-5 accent-brand"
          name="always_open"
          type="checkbox"
          checked={alwaysOpen}
          onChange={(event) => setAlwaysOpen(event.target.checked)}
          disabled={pending}
        />
        <span>
          <span className="block text-sm font-black text-ink">
            Aberto 24 horas, todos os dias
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
            Marque esta opção se a loja nunca fecha.
          </span>
        </span>
      </label>

      <div className="space-y-3" aria-disabled={alwaysOpen || pending}>
        {schedule.map((day) => (
          <div
            key={day.weekday}
            className="grid gap-3 rounded-2xl border border-line bg-canvas p-4 sm:grid-cols-[8rem_7rem_1fr] sm:items-center"
          >
            <div>
              <p className="text-sm font-black text-ink sm:hidden">{day.label}</p>
              <p className="hidden text-sm font-black text-ink sm:block">{day.shortLabel}</p>
            </div>

            <input
              type="hidden"
              name={`day_${day.weekday}_closed`}
              value={day.isClosed ? "true" : "false"}
            />
            <button
              type="button"
              role="switch"
              aria-checked={!day.isClosed}
              disabled={alwaysOpen || pending}
              onClick={() => updateDay(day.weekday, { isClosed: !day.isClosed })}
              className={`min-h-10 rounded-xl border px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                day.isClosed
                  ? "border-line bg-white text-muted"
                  : "border-positive/25 bg-positive-soft text-positive"
              }`}
            >
              {day.isClosed ? "Fechado" : "Aberto"}
            </button>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <label className="sr-only" htmlFor={`opens-${day.weekday}`}>
                Abertura de {day.label}
              </label>
              <input
                id={`opens-${day.weekday}`}
                name={`day_${day.weekday}_opens`}
                type="time"
                value={day.opensAt}
                onChange={(event) =>
                  updateDay(day.weekday, { opensAt: event.target.value })
                }
                disabled={alwaysOpen || day.isClosed || pending}
                required={!alwaysOpen && !day.isClosed}
                className="min-h-12 min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-line/30"
              />
              <span className="text-xs font-bold text-muted">até</span>
              <label className="sr-only" htmlFor={`closes-${day.weekday}`}>
                Fechamento de {day.label}
              </label>
              <input
                id={`closes-${day.weekday}`}
                name={`day_${day.weekday}_closes`}
                type="time"
                value={day.closesAt}
                onChange={(event) =>
                  updateDay(day.weekday, { closesAt: event.target.value })
                }
                disabled={alwaysOpen || day.isClosed || pending}
                required={!alwaysOpen && !day.isClosed}
                className="min-h-12 min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-line/30"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-line pt-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-6 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {pending ? "Salvando horários..." : "Salvar horários"}
        </button>
      </div>
    </form>
  );
}
