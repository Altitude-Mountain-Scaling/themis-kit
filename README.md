# themis-kit

Connect any website to [Themis](https://themisre.com), the CRM from Altitude
Mountain Scaling. Three things a site can do with it:

1. **Leads.** Every form on the site lands in the business's shared Leads
   inbox, with an instant auto-reply, speed-to-lead scoring, drips and the
   Themis app on the owner's phone. No more "contact form → inbox → forgotten".
2. **Blog.** The owner (or Themis's AI writer) writes posts inside Themis.
   The site pulls published posts over the API and renders them. Nothing on
   the site is edited to publish.
3. **Workspaces.** If you build sites for several businesses, a partner
   secret lets you give each customer their own Themis workspace from the
   terminal. Themis emails the owner a sign-in link; you get their key.

Everything here is copy-in TypeScript with zero dependencies. It runs in
Node 18+ and edge runtimes: Next.js, Remix, Astro, SvelteKit, Nuxt, Express,
Vercel or Netlify functions. For sites with no backend (WordPress, Webflow,
Squarespace, static HTML) there is an iframe embed and a browser-side form.

## Get a key

A workspace has one publishable key, starts with `thm_`. It can only create
leads and read published posts, so it is safe in a browser.

- **The business already uses Themis:** the owner copies it from
  Themis → Developers and adds your site's domain to the allowlist there.
- **The business is new to Themis:** either send Altitude the owner's name,
  email, business name, business type and website, and we provision the
  workspace and send you the key, or use your partner secret and run
  `scripts/provision.mjs` yourself (see Provisioning).

Put the key in the site's environment as `THEMIS_API_KEY`. See
[.env.example](.env.example).

## Quick start

```bash
# copy the two source files into your project
cp src/themis.ts   your-site/lib/themis.ts
cp src/markdown.ts your-site/lib/markdown.ts
```

Send a lead (server-side, anywhere):

```ts
import { deliverLead, siteKey } from "@/lib/themis";

await deliverLead(siteKey(), {
  name: "Jane Doe",
  email: "jane@example.com",   // email or phone, at least one
  phone: "+19705551234",
  message: "Do you have a room for two on Friday?",
  sourcePath: "/contact",      // which page converted
  utm: { utm_source: "google" },
});
```

Read the blog:

```ts
import { fetchPosts, fetchPost, siteKey } from "@/lib/themis";
import { toHtml } from "@/lib/markdown";

const posts = await fetchPosts(siteKey());          // newest first
const post = await fetchPost(siteKey(), "our-first-post"); // or null
const html = toHtml(post.body);                      // for non-React sites
```

## Examples

| Path | What it is |
| --- | --- |
| [examples/next](examples/next) | A Next.js App Router site: cached blog index and post pages, a contact form server action, and a JSON `/api/lead` route for static front ends. Copy the folders in; the files import from `@/lib/themis`, `@/lib/markdown` and `@/components/Markdown`. |
| [examples/html/contact.html](examples/html/contact.html) | A plain HTML form posting to Themis from the browser. The page's domain must be on the key's allowlist. |
| [examples/html/embed.html](examples/html/embed.html) | Zero code: Themis's hosted form in an iframe. Paste into any page builder. |

The Next.js blog uses `"use cache"` with a one-minute life, which needs
`cacheComponents: true` in `next.config` on Next 16. On an older Next, wrap
the same functions in `unstable_cache` with `revalidate: 60`.

## Provisioning workspaces for your customers

With a partner secret (ask Altitude), each customer gets their own workspace
on the Enterprise plan, named after the business, with the key already
issued and the owner emailed a one-time sign-in link.

```bash
cp .env.example .env     # fill in THEMIS_PARTNER_SECRET and THEMIS_PARTNER_NAME
node scripts/provision.mjs --email owner@example.com --business "Tenmile Lodge" \
  --name "Jane Doe" --type general --site https://tenmilelodge.com
node scripts/provision.mjs --lookup owner@example.com
```

It prints `THEMIS_API_KEY=thm_…` for the customer's site. Running it again
for the same owner returns the same key and sends nothing. The `--site`
hosts go on the key's browser allowlist. Business types: `real_estate`,
`mortgage`, `insurance`, `home_services`, `fitness`, `beauty`, `legal`,
`medical`, `auto`, `agency`, `coaching`, `general`. Omit `--type` and the
owner picks on first sign-in.

The same calls are available in code as `findAccount`, `provisionAccount`
and `ensureAccount` in `src/themis.ts`.

Keep the partner secret server-side only. It can create accounts.

## API reference

Base URL `https://themisre.com`. Auth is `Authorization: Bearer <key>`.
Server-to-server calls (no `Origin` header) always pass. Browser calls pass
only from hosts on the key's allowlist. Themis answers `401` for a bad key
and `403` for a host that is not allowed.

### `POST /api/v1/lead`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+19705551234",
  "message": "Do you have a room for two on Friday?",
  "sourcePath": "/contact",
  "utm": { "utm_source": "google", "utm_medium": "cpc" }
}
```

`name` plus `email` or `phone` are required. `utm_*` keys may also be sent
as top-level fields or as query params on the URL. Real-estate workspaces
also accept `intent` (`"buyer"` or `"seller"`), `hasAgent` (boolean),
`address` and `listingRef`. Answers `{ "ok": true }`.

Limits: 5 leads per visitor IP per minute, 30 per workspace per hour, and
one auto-reply per contact per hour. A `429` carries a message you can show.

SMS consent is never collected through this endpoint. A business that wants
to text visitors links to a Themis capture page (`/c/<slug>`), where consent
is recorded.

### `GET /api/v1/posts` and `GET /api/v1/posts/<slug>`

```json
{
  "posts": [
    {
      "slug": "our-first-post",
      "title": "Our first post",
      "excerpt": "One sentence for the index.",
      "coverUrl": "https://…/cover.jpg",
      "body": "## A heading\n\nParagraphs, **bold**, *italic*, - lists, > quotes.",
      "publishedAt": "2026-10-09T18:00:00.000Z"
    }
  ]
}
```

The single-post route returns `{ "post": {…} }` or `404` for anything that
is not a published post. `body` is markdown-lite; `src/markdown.ts` parses it
to blocks, to plain text (`toPlainText`), or to HTML (`toHtml`).

### Hosted form: `/embed/form?key=thm_…`

An iframe, 460px tall works for the default fields. Flags: `&phone=0` hides
the phone field; `&intent=1` and `&agent=1` add the real-estate questions;
`utm_*` params pass through to the lead.

### Partner: `POST /api/partner/provision`, `GET /api/partner/account?email=`

Bearer the partner secret. Provision body: `{ email, name, business,
businessType?, partner, origins? }`. Both answer with the owner's `apiKey`.
Limits: 30 provisions and 60 lookups per minute.

## Checking it works

1. Submit the site's form from the live domain.
2. Open the workspace in Themis: the lead is in Leads, marked with the
   `sourcePath`, and the visitor got the auto-reply.
3. Publish a post in Themis → Presence → Blog and reload `/blog` after a
   minute.

## Questions

hello@altitudemountainscaling.com
