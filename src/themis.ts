/*
 * Themis CRM client — one file, no dependencies, copy it into any Node 18+ or
 * edge runtime (Next.js, Remix, Astro, SvelteKit, Netlify/Vercel functions,
 * a plain Express server).
 *
 * Themis (https://themisre.com) is the CRM every Altitude Mountain Scaling
 * client gets. A website talks to it over three small surfaces:
 *
 *   LEADS    POST /api/v1/lead
 *            Authed by a workspace's publishable "thm_" key. Themis needs a
 *            name plus an email or a phone number. It rate-limits (5 per IP
 *            per minute, 30 per workspace per hour), de-dupes the visitor
 *            auto-reply, and upserts into the workspace's shared Leads inbox.
 *
 *   POSTS    GET /api/v1/posts and /api/v1/posts/<slug>
 *            Same key. Published posts written in Themis (Presence → Blog,
 *            by hand or by its AI writer) come back as markdown-lite. Drafts
 *            never leave Themis.
 *
 *   PARTNER  POST /api/partner/provision and GET /api/partner/account
 *            Authed by a partner secret. A web agency with a secret can give
 *            each of its customers their own Themis workspace: Themis creates
 *            the owner's account, names the workspace after the business,
 *            issues the "thm_" key, and emails the owner a one-time sign-in
 *            link. Idempotent on the owner's email.
 *
 * Server-to-server calls send no Origin header, so the key's browser origin
 * allowlist does not apply to them. Calls from a browser (fetch on the page,
 * the embed iframe) work only from hosts on the key's allowlist, which the
 * owner edits in Themis → Developers, or which you pass as `websites` when
 * provisioning.
 *
 * Env (all optional except the key you actually use):
 *   THEMIS_URL             Themis origin; defaults to https://themisre.com
 *   THEMIS_API_KEY         this site's publishable key ("thm_…")
 *   THEMIS_PARTNER_SECRET  your agency's partner secret (ask Altitude)
 *   THEMIS_PARTNER_NAME    your agency's name, shown in the owner's welcome email
 */

const THEMIS_URL = (process.env.THEMIS_URL || "https://themisre.com").replace(/\/$/, "");
const LEAD_URL = `${THEMIS_URL}/api/v1/lead`;
const POSTS_URL = `${THEMIS_URL}/api/v1/posts`;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type ThemisLead = {
  name: string;
  email?: string | null;
  phone?: string | null;
  message: string;
  /** Path on the site the lead came from, e.g. "/contact". Shown on the lead. */
  sourcePath?: string | null;
  /** The utm_* params the visitor arrived with; see sanitizeUtm. */
  utm?: Record<string, string> | null;
  /** Real-estate workspaces only: which side the visitor is on. */
  intent?: "buyer" | "seller" | null;
  /** Real-estate workspaces only: "already working with an agent?" */
  hasAgent?: boolean | null;
  /** Real-estate workspaces only: a property address (valuation requests). */
  address?: string | null;
  /** Your own reference for the page or listing, up to 200 chars. */
  listingRef?: string | null;
};

/** What a customer needs to carry for Themis to be set up for them. */
export type ThemisClient = {
  /** The business name; becomes the workspace name. */
  name: string;
  /** The owner's email. Their Themis sign-in, and the idempotency key. */
  ownerEmail: string;
  /** The owner's name, for the welcome email. Defaults to the business name. */
  ownerName?: string;
  /** The customer's website(s). Their hosts go on the key's browser allowlist
   * so the embed form and in-page fetch calls work from those pages. */
  websites?: string[];
  /** What kind of business. Sets the words the owner sees in Themis. Omitted,
   * the owner picks on first sign-in. */
  businessType?: ThemisBusinessType;
};

/** Themis's business types. */
export const THEMIS_BUSINESS_TYPES = [
  "real_estate",
  "mortgage",
  "insurance",
  "home_services",
  "fitness",
  "beauty",
  "legal",
  "medical",
  "auto",
  "agency",
  "coaching",
  "general",
] as const;
export type ThemisBusinessType = (typeof THEMIS_BUSINESS_TYPES)[number];

// ── Keys ────────────────────────────────────────────────────────────────

/** Only a publishable lead key ("thm_…") is accepted; anything else is ignored
 * with a warning rather than sent to an endpoint it was never issued for. */
export function leadKey(raw: string | undefined, label = "THEMIS_API_KEY"): string {
  const key = (raw ?? "").trim();
  if (!key) return "";
  if (!key.startsWith("thm_")) {
    console.warn(`[themis] ${label} is not a publishable lead key (expected a "thm_" prefix); ignoring it.`);
    return "";
  }
  return key;
}

/** This site's key from THEMIS_API_KEY, or "" when not configured. */
export function siteKey(): string {
  return leadKey(process.env.THEMIS_API_KEY);
}

export function themisUrl(): string {
  return THEMIS_URL;
}

export function partnerConfigured(): boolean {
  return Boolean(process.env.THEMIS_PARTNER_SECRET);
}

// ── Leads ───────────────────────────────────────────────────────────────

/** Keep only the five utm_* keys, trimmed and length-capped, mirroring what
 * Themis accepts. Pass a parsed query string, a FormData-derived object, or
 * anything object-shaped. Returns null when none are present. */
export function sanitizeUtm(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const raw = v as Record<string, unknown>;
  let utm: Record<string, string> | null = null;
  for (const k of UTM_KEYS) {
    const val = raw[k];
    if (typeof val === "string" && val.trim()) {
      utm ??= {};
      utm[k] = val.trim().slice(0, 200);
    }
  }
  return utm;
}

export type ThemisAppointment = {
  name: string;
  phone?: string | null;
  email?: string | null;
  /** ISO instants. */
  startsAt: string;
  endsAt?: string | null;
  /** What was booked, as the calendar should show it: "Free walkthrough". */
  title: string;
  notes?: string | null;
  location?: string | null;
  /** Where it was booked: "site/book", "front-desk/voice", ... */
  sourcePath?: string | null;
};

/** Book an appointment onto a workspace's calendar, against the contact it
 * came from (created in Leads if new). Throws on a missing key or a non-2xx. */
export async function createAppointment(key: string, appt: ThemisAppointment): Promise<{ id?: string; contactId?: string }> {
  if (!key) throw new Error("Themis key is not configured.");
  const res = await fetch(`${THEMIS_URL}/api/v1/appointment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: appt.name.trim().slice(0, 200),
      phone: appt.phone?.trim() || null,
      email: appt.email?.trim() || null,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt ?? null,
      title: appt.title.slice(0, 200),
      notes: appt.notes?.slice(0, 4000) ?? null,
      location: appt.location ?? null,
      sourcePath: appt.sourcePath ?? null,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Themis responded ${res.status} ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as { id?: string; contactId?: string };
}

/** Deliver one lead to a Themis workspace. Throws when the key is missing or
 * Themis answers non-2xx; callers decide how to degrade (log it, show the
 * visitor a direct email, retry). */
export async function deliverLead(key: string, lead: ThemisLead): Promise<void> {
  if (!key) throw new Error("Themis lead key is not configured.");
  if (!lead.name.trim() || (!lead.email?.trim() && !lead.phone?.trim())) {
    throw new Error("Themis needs a name plus an email or phone number.");
  }

  const res = await fetch(LEAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: lead.name.trim().slice(0, 200),
      email: lead.email?.trim() || null,
      phone: lead.phone?.trim() || null,
      message: lead.message.trim().slice(0, 4000),
      sourcePath: lead.sourcePath || null,
      utm: lead.utm ?? null,
      ...(lead.intent ? { intent: lead.intent } : {}),
      ...(typeof lead.hasAgent === "boolean" ? { hasAgent: lead.hasAgent } : {}),
      ...(lead.address ? { address: lead.address } : {}),
      ...(lead.listingRef ? { listingRef: lead.listingRef } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    // Say what Themis actually answered: a rejected key (401), a host that is
    // not on the allowlist (403) and a network fault look identical to the
    // visitor, and that is what makes a bad key hard to track down.
    const detail = await res.text().catch(() => "");
    throw new Error(`Themis responded ${res.status} ${detail.slice(0, 300)}`);
  }
}

// ── Blog posts ──────────────────────────────────────────────────────────

/** A published post as Themis serves it. `body` is markdown-lite: ## and ###
 * headings, paragraphs, **bold**, *italic*, `code`, - and 1. lists, > quotes,
 * [links](https://…). No HTML, no front matter. src/markdown.ts parses it. */
export type ThemisPost = {
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string;
  body: string;
  /** ISO timestamp. */
  publishedAt: string;
};

async function postsFetch(path: string, key: string): Promise<Response> {
  if (!key) throw new Error("Themis lead key is not configured.");
  return fetch(`${POSTS_URL}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

/** Every published post in the workspace, newest first. Throws when Themis
 * can't be reached or rejects the key, so a failure is never cached as "no
 * posts". */
export async function fetchPosts(key: string): Promise<ThemisPost[]> {
  const res = await postsFetch("", key);
  if (!res.ok) throw new Error(`Themis posts: responded ${res.status}`);
  const data = (await res.json()) as { posts?: ThemisPost[] };
  return data.posts ?? [];
}

/** One published post by slug, or null when Themis has no such published post
 * (a draft, an unpublished post, or a typo all look the same from here). */
export async function fetchPost(key: string, slug: string): Promise<ThemisPost | null> {
  const res = await postsFetch(`/${encodeURIComponent(slug)}`, key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Themis post ${slug}: responded ${res.status}`);
  const data = (await res.json()) as { post?: ThemisPost };
  return data.post ?? null;
}

/** Slugs Themis will accept: lowercase, digits, dashes. Anything else is not
 * a post and is not worth a round trip. */
export function isPostSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 48;
}

// ── Partner API ─────────────────────────────────────────────────────────

export type ThemisAccount = {
  email: string;
  apiKey: string;
  /** True when this call created the workspace and Themis emailed the owner. */
  created: boolean;
  emailed: boolean;
  /** Hosts the key may be used from in a browser. */
  allowedOrigins: string[];
};

async function partnerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const secret = process.env.THEMIS_PARTNER_SECRET;
  if (!secret) throw new Error("THEMIS_PARTNER_SECRET is not set.");
  return fetch(`${THEMIS_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

async function failure(res: Response, what: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(`${what}: Themis responded ${res.status}${body.error ? ` ${body.error}` : ""}`);
}

/** Look up a customer's workspace by owner email. Creates nothing. */
export async function findAccount(ownerEmail: string): Promise<{ apiKey: string } | null> {
  const res = await partnerFetch(`/api/partner/account?email=${encodeURIComponent(ownerEmail)}`);
  if (!res.ok) throw await failure(res, "Account lookup failed");
  const data = (await res.json()) as { exists: boolean; apiKey?: string | null };
  if (!data.exists) return null;
  return { apiKey: data.apiKey ?? "" };
}

/**
 * Give a customer a Themis workspace (or confirm the one they have). Themis
 * creates the owner's account, names the workspace after the business, issues
 * the lead key, and emails the owner a sign-in link on first creation.
 */
export async function provisionAccount(client: ThemisClient): Promise<ThemisAccount> {
  const partner = (process.env.THEMIS_PARTNER_NAME ?? "").trim();
  if (!partner) throw new Error("THEMIS_PARTNER_NAME is not set; it names your agency in the owner's welcome email.");
  if (!client.ownerEmail) throw new Error(`${client.name} has no ownerEmail.`);
  const res = await partnerFetch("/api/partner/provision", {
    method: "POST",
    body: JSON.stringify({
      email: client.ownerEmail,
      name: client.ownerName || client.name,
      business: client.name,
      partner,
      origins: client.websites ?? [],
      ...(client.businessType ? { businessType: client.businessType } : {}),
    }),
  });
  if (!res.ok) throw await failure(res, `Provisioning ${client.name} failed`);
  return (await res.json()) as ThemisAccount;
}

/** The customer's workspace, provisioned if it doesn't exist yet. */
export async function ensureAccount(client: ThemisClient): Promise<ThemisAccount> {
  const existing = await findAccount(client.ownerEmail);
  if (existing?.apiKey && !client.websites?.length) {
    return { email: client.ownerEmail, apiKey: existing.apiKey, created: false, emailed: false, allowedOrigins: [] };
  }
  // No account, no key, or websites to allow: provisioning handles all three.
  return provisionAccount(client);
}

// ── Integration snippets ────────────────────────────────────────────────

/** What to paste into a customer's website so inquiries land in their Themis. */
export function integrationSnippets(apiKey: string) {
  return {
    /** Zero-code: Themis's hosted lead form in an iframe. Add &phone=0 to hide
     * the phone field. utm_* params on the iframe src pass through. */
    iframe: `<iframe src="${THEMIS_URL}/embed/form?key=${apiKey}" style="width:100%;height:460px;border:0" loading="lazy" title="Contact form"></iframe>`,
    /** A site's own form posting server-side (no origin allowlist needed). */
    serverPost: `fetch("${LEAD_URL}", {
  method: "POST",
  headers: { Authorization: "Bearer ${apiKey}", "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, phone, message, sourcePath: "/contact" }),
});`,
  };
}
