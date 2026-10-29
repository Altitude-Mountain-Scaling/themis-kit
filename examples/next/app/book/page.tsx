import { connection } from "next/server";
import { BOOKING, openDays, zoneLabel } from "@/lib/booking";
import BookingForm from "./BookingForm";

/* The booking page: the same questions as /contact, plus a day and a time.
   Rendered per request so the open slots are always current. */
export default async function BookPage() {
  await connection();
  const now = new Date();
  return (
    <BookingForm
      days={openDays(now)}
      title={BOOKING.title}
      zone={zoneLabel(now)}
    />
  );
}
