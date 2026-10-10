"use client";

import { useActionState } from "react";
import { sendInquiry, type ContactState } from "./actions";

const initial: ContactState = { status: "idle", message: "" };

/* A contact form wired to the server action. Add hidden utm_* inputs from
   the URL if you want attribution on the lead (see UtmFields). */
export default function ContactPage() {
  const [state, action, pending] = useActionState(sendInquiry, initial);

  if (state.status === "sent") return <p role="status">{state.message}</p>;

  return (
    <form action={action}>
      <UtmFields />
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
      <button type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
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
