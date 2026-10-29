"use client";

import { useActionState, useState } from "react";
import type { BookingDay } from "@/lib/booking";
import { bookAppointment, type BookingState } from "./actions";

const initial: BookingState = { status: "idle", message: "" };

/* The contact questions plus a day picker and the open times for that day.
   The day and time go to the server action as plain `date` and `time` fields,
   and the action checks them against the schedule again. */
export default function BookingForm({ days, title, zone }: { days: BookingDay[]; title: string; zone: string }) {
  const [state, action, pending] = useActionState(bookAppointment, initial);
  const [date, setDate] = useState(days[0]?.date ?? "");
  const [time, setTime] = useState("");
  const day = days.find((d) => d.date === date);

  if (state.status === "booked") return <p role="status">{state.message}</p>;

  return (
    <form action={action}>
      <h1>Book a {title.toLowerCase()}</h1>
      <UtmFields />

      <fieldset>
        <legend>Pick a day</legend>
        {days.length === 0 && <p>No open times in the next two weeks. Send us a message on the contact page instead.</p>}
        {days.map((d) => (
          <label key={d.date}>
            <input
              type="radio"
              name="date"
              value={d.date}
              checked={d.date === date}
              onChange={() => {
                setDate(d.date);
                setTime("");
              }}
              required
            />
            {d.label}
          </label>
        ))}
      </fieldset>

      {day && (
        <fieldset>
          <legend>Pick a time ({zone})</legend>
          {day.slots.map((s) => (
            <label key={s.time}>
              <input
                type="radio"
                name="time"
                value={s.time}
                checked={s.time === time}
                onChange={() => setTime(s.time)}
                required
              />
              {s.label}
            </label>
          ))}
        </fieldset>
      )}

      <label>
        Name
        <input name="name" required autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label>
        How can we help?
        <textarea name="message" required rows={5} />
      </label>
      {state.status === "error" && <p role="alert">{state.message}</p>}
      <button type="submit" disabled={pending || !day}>{pending ? "Booking…" : "Book it"}</button>
    </form>
  );
}

/* Carries the utm_* params the visitor arrived with into the submission. */
function UtmFields() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return (
    <>
      {["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
        .filter((k) => params.get(k))
        .map((k) => <input key={k} type="hidden" name={k} value={params.get(k) ?? ""} />)}
    </>
  );
}
