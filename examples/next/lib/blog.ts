/*
 * The blog: posts are written in Themis (Presence → Blog) and pulled here.
 *
 * Each read is cached for a minute, so hitting Publish in Themis shows up on
 * the site within about a minute without a redeploy. Everything is tagged
 * "themis-posts" so you can bust it on demand with revalidateTag.
 *
 * "use cache" needs `cacheComponents: true` in next.config (Next 16). On an
 * older Next, wrap the same bodies in unstable_cache(fn, [key], { revalidate:
 * 60, tags: ["themis-posts"] }) instead.
 */
import { cacheLife, cacheTag } from "next/cache";
import { fetchPost, fetchPosts, siteKey, type ThemisPost } from "@/lib/themis";

export type { ThemisPost };
export { isPostSlug } from "@/lib/themis";
export { readingMinutes } from "@/lib/markdown";

export async function getPosts(): Promise<ThemisPost[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("themis-posts");
  const key = siteKey();
  if (!key) return [];
  return fetchPosts(key);
}

export async function getPost(slug: string): Promise<ThemisPost | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("themis-posts", `themis-post-${slug}`);
  const key = siteKey();
  if (!key) return null;
  return fetchPost(key, slug);
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });

export function formatPostDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormat.format(d);
}
