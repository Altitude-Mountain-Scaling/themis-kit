import { deliverLead, sanitizeUtm, siteKey } from "@/lib/themis";

/*
 * POST /api/lead — for a static or client-rendered front end that posts
 * JSON (or a plain HTML form) to its own backend. The key stays on the
 * server. Body: { name, email?, phone?, message, sourcePath?, utm_*? }.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const type = req.headers.get("content-type") ?? "";
    body = type.includes("application/json")
      ? ((await req.json()) as Record<string, unknown>)
      : Object.fromEntries((await req.formData()).entries());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const name = str("name");
  const email = str("email");
  const phone = str("phone");
  const message = str("message");
  if (!name || (!email && !phone) || !message) {
    return Response.json({ error: "Send a name, an email or phone number, and a message." }, { status: 400 });
  }

  const key = siteKey();
  if (!key) return Response.json({ error: "THEMIS_API_KEY is not set." }, { status: 503 });

  try {
    await deliverLead(key, {
      name,
      email,
      phone,
      message,
      sourcePath: str("sourcePath") || new URL(req.headers.get("referer") ?? "http://x/").pathname,
      utm: sanitizeUtm(body),
    });
  } catch (err) {
    console.error("[api/lead] Themis delivery failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't send that just now." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
