export type BusinessHour = {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

export function getBusinessSchedule(hours: BusinessHour[], timezone: string) {
  if (hours.length === 0) {
    return { hoursAvailable: false, isOpen: false, closesAt: "Consulte o horário" };
  }

  const alwaysOpen =
    new Set(hours.map((item) => item.weekday)).size === 7 &&
    hours.every(
      (item) =>
        !item.is_closed &&
        item.opens_at?.startsWith("00:00") &&
        item.closes_at?.startsWith("23:59"),
    );

  if (alwaysOpen) {
    return {
      alwaysOpen: true,
      hoursAvailable: true,
      isOpen: true,
      closesAt: "24 horas",
    };
  }

  const weekdayCodes = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = weekdayCodes.indexOf(
    parts.find((part) => part.type === "weekday")?.value ?? "",
  );
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const currentMinutes = hour * 60 + minute;
  const today = hours.filter((item) => item.weekday === weekday && !item.is_closed);
  const openInterval = today.find((item) => {
    if (!item.opens_at || !item.closes_at) return false;
    const [openHour, openMinute] = item.opens_at.split(":").map(Number);
    const [closeHour, closeMinute] = item.closes_at.split(":").map(Number);
    const opens = openHour * 60 + openMinute;
    const closes = closeHour * 60 + closeMinute;
    return closes > opens
      ? currentMinutes >= opens && currentMinutes < closes
      : currentMinutes >= opens || currentMinutes < closes;
  });

  if (!openInterval?.closes_at) {
    return { hoursAvailable: true, isOpen: false, closesAt: "Fechado agora" };
  }

  return {
    hoursAvailable: true,
    isOpen: true,
    closesAt: openInterval.closes_at.slice(0, 5).replace(":", "h"),
  };
}
