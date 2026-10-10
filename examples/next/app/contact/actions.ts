"use server";

import { deliverLead, sanitizeUtm, siteKey } from "@/lib/themis";

export type ContactState = {
  status: "idle" | "sent" | "error";
  message: string;
};

// Where the visitor is pointed when Themis can't be reached. Nothing is
// silently dropped: the inquiry is also logged server-side.
const FALLBACK_EMAIL = process.env.CONTACT_FALLBACK_EMAIL ?? "hello@example.com";

/** A server action for a contact form: name, email and/or phone, message,
 * plus any utm_* hidden inputs. Runs on the server, so the key stays private
 * and the browser origin allowlist does not apply. */
export async function sendInquiry(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const utm = sanitizeUtm(
    Object.fromEntries(Array.from(formData.entries()).filter(([k]) => k.startsWith("utm_"))),
  );

  if (!name || (!email && !phone) || !message) {
    return { status: "error", message: "Add your name, an email or phone number, and a few words." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That email doesn't look right. Check it and send again." };
  }

  const key = siteKey();
  if (!key) {
    console.warn("[contact] THEMIS_API_KEY is not set; logging the inquiry instead.");
    console.log(`[contact] ${JSON.stringify({ name, email, phone, message, utm, at: new Date().toISOString() })}`);
    return { status: "sent", message: "Sent. We'll reply within one business day." };
  }

  try {
    await deliverLead(key, { name, email, phone, message, sourcePath: "/contact", utm });
  } catch (err) {
    console.error(
      `[contact] Themis delivery failed: ${err instanceof Error ? err.message : String(err)} ${JSON.stringify({ name, email, phone, message })}`,
    );
    return { status: "error", message: `We couldn't send that just now. Email ${FALLBACK_EMAIL} and we'll pick it up from there.` };
  }

  return { status: "sent", message: "Sent. We'll reply within one business day." };
}
