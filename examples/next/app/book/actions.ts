"use server";

import { createAppointment, sanitizeUtm, siteKey } from "@/lib/themis";
import { BOOKING, describeSlot, isBookable, slotEnd, slotStart } from "@/lib/booking";

export type BookingState = {
  status: "idle" | "booked" | "error";
  message: string;
};

// Where the visitor is pointed when Themis can't be reached. Nothing is
// silently dropped: the booking is also logged server-side.
const FALLBACK_EMAIL = process.env.CONTACT_FALLBACK_EMAIL ?? "hello@example.com";

/** A server action for the booking form: the contact questions (name, email
 * and/or phone, message) plus the chosen day and time. Books the slot onto the
 * workspace's calendar in Themis, with the visitor's answers as the notes. */
export async function bookAppointment(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const utm = sanitizeUtm(
    Object.fromEntries(Array.from(formData.entries()).filter(([k]) => k.startsWith("utm_"))),
  );

  if (!name || (!email && !phone) || !message) {
    return { status: "error", message: "Add your name, an email or phone number, and a few words." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That email doesn't look right. Check it and send again." };
  }
  if (!date || !time) {
    return { status: "error", message: "Pick a day and a time." };
  }
  if (!isBookable(date, time)) {
    return { status: "error", message: "That time isn't available any more. Pick another one." };
  }

  const when = describeSlot(date, time);
  const notes = [
    message,
    utm ? `\nArrived via ${Object.entries(utm).map(([k, v]) => `${k}=${v}`).join(", ")}` : "",
  ].join("");

  const key = siteKey();
  if (!key) {
    console.warn("[book] THEMIS_API_KEY is not set; logging the booking instead.");
    console.log(`[book] ${JSON.stringify({ name, email, phone, message, date, time, utm, at: new Date().toISOString() })}`);
    return { status: "booked", message: `You're booked for ${when}. We'll be in touch to confirm.` };
  }

  try {
    await createAppointment(key, {
      name,
      email,
      phone,
      startsAt: slotStart(date, time).toISOString(),
      endsAt: slotEnd(date, time).toISOString(),
      title: BOOKING.title,
      notes,
      sourcePath: "/book",
    });
  } catch (err) {
    console.error(
      `[book] Themis booking failed: ${err instanceof Error ? err.message : String(err)} ${JSON.stringify({ name, email, phone, message, date, time })}`,
    );
    return { status: "error", message: `We couldn't book that just now. Email ${FALLBACK_EMAIL} and we'll get you scheduled.` };
  }

  return { status: "booked", message: `You're booked for ${when}. We'll be in touch to confirm.` };
}
