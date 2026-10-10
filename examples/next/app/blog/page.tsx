import type { Metadata } from "next";
import Link from "next/link";
import { formatPostDate, getPosts, readingMinutes, type ThemisPost } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  alternates: { canonical: "/blog" },
};

/* The blog index. Posts are written in Themis and arrive through lib/blog.ts;
   nothing here is edited by hand. */
export default function BlogPage() {
  return (
    <main>
      <h1>Blog</h1>
      <PostList />
    </main>
  );
}

async function PostList() {
  let posts: ThemisPost[] | null = null;
  try {
    posts = await getPosts();
  } catch (err) {
    console.error("[blog] couldn't load posts:", err instanceof Error ? err.message : err);
  }

  if (!posts) return <p>The posts didn&apos;t load. Try again in a minute.</p>;
  if (posts.length === 0) return <p>The first post is on its way.</p>;

  return (
    <ul>
      {posts.map((p) => (
        <li key={p.slug}>
          <Link href={`/blog/${p.slug}`}>
            <time dateTime={p.publishedAt}>{formatPostDate(p.publishedAt)}</time>
            {" · "}
            {readingMinutes(p.body)} min
            <h2>{p.title}</h2>
            {p.excerpt && <p>{p.excerpt}</p>}
            {p.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.coverUrl} alt="" loading="lazy" width={640} height={360} />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
