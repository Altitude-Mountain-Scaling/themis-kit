/*
 * The booking schedule: which days and times a visitor can pick on /book.
 *
 * Times are the business's wall-clock times in BOOKING.timeZone, whatever
 * time zone the visitor is in. The page shows them with that zone named, and
 * the server action turns the chosen day and time into an ISO instant for
 * Themis. Edit BOOKING to match the business's hours.
 *
 * This file has no server-only imports, so both the page and the action use
 * it, and the action re-checks every submission against it.
 */

export const BOOKING = {
  /** What the calendar entry is called in Themis. */
  title: "Free consultation",
  /** IANA zone the hours below are in. */
  timeZone: "America/Denver",
  /** Length of one appointment, in minutes. Slots start this far apart. */
  slotMinutes: 30,
  /** Open hours, 24h "HH:MM". The last slot ends at or before `closes`. */
  opens: "09:00",
  closes: "17:00",
  /** Open weekdays: 0 = Sunday … 6 = Saturday. */
  weekdays: [1, 2, 3, 4, 5],
  /** How many days ahead a visitor can book, counting today. */
  daysAhead: 14,
  /** No bookings sooner than this many minutes from now. */
  minNoticeMinutes: 120,
};

export type BookingSlot = { time: string; label: string };
export type BookingDay = { date: string; label: string; slots: BookingSlot[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Every open day in the window that still has a bookable slot. */
export function openDays(now = new Date()): BookingDay[] {
  const today = dateInZone(now, BOOKING.timeZone);
  const days: BookingDay[] = [];
  for (let i = 0; i < BOOKING.daysAhead; i++) {
    const date = addDays(today, i);
    if (!BOOKING.weekdays.includes(weekday(date))) continue;
    const slots = daySlots().filter((time) => isBookable(date, time, now));
    if (!slots.length) continue;
    days.push({
      date,
      label: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
        .format(new Date(`${date}T00:00:00Z`)),
      slots: slots.map((time) => ({ time, label: timeLabel(time) })),
    });
  }
  return days;
}

/** True when `date` + `time` is a slot the schedule offers and it is far
 * enough in the future. Use it to validate what the browser sent. */
export function isBookable(date: string, time: string, now = new Date()): boolean {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return false;
  if (!BOOKING.weekdays.includes(weekday(date))) return false;
  if (!daySlots().includes(time)) return false;
  const today = dateInZone(now, BOOKING.timeZone);
  if (date < today || date >= addDays(today, BOOKING.daysAhead)) return false;
  return slotStart(date, time).getTime() >= now.getTime() + BOOKING.minNoticeMinutes * 60_000;
}

/** The instant a slot starts, read as wall-clock time in BOOKING.timeZone. */
export function slotStart(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // The zone's offset at the guessed instant, then once more in case the
  // guess landed on the other side of a DST change.
  let t = wall - zoneOffset(wall, BOOKING.timeZone);
  t = wall - zoneOffset(t, BOOKING.timeZone);
  return new Date(t);
}

export function slotEnd(date: string, time: string): Date {
  return new Date(slotStart(date, time).getTime() + BOOKING.slotMinutes * 60_000);
}

/** "Tue, Nov 3 at 9:30 AM (Mountain Time)" for confirmations. */
export function describeSlot(date: string, time: string): string {
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING.timeZone, timeZoneName: "long" })
    .formatToParts(slotStart(date, time))
    .find((p) => p.type === "timeZoneName")?.value;
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
  return `${day} at ${timeLabel(time)}${zone ? ` (${zone})` : ""}`;
}

/** The short zone name to show beside the times, e.g. "MST". */
export function zoneLabel(now = new Date()): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: BOOKING.timeZone, timeZoneName: "short" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? BOOKING.timeZone
  );
}

function daySlots(): string[] {
  const out: string[] = [];
  const close = minutes(BOOKING.closes);
  for (let t = minutes(BOOKING.opens); t + BOOKING.slotMinutes <= close; t += BOOKING.slotMinutes) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function dateInZone(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function addDays(date: string, n: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Milliseconds the zone is ahead of UTC at instant `ts`. */
function zoneOffset(ts: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}
