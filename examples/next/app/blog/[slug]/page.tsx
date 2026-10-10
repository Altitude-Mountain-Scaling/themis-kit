import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { formatPostDate, getPost, getPosts, isPostSlug, readingMinutes } from "@/lib/blog";

// Your site's public origin, for canonical and Open Graph URLs.
const SITE = process.env.PUBLIC_BASE_URL ?? "https://example.com";
const PUBLISHER = process.env.SITE_NAME ?? "Our company";

type Props = { params: Promise<{ slug: string }> };

/* Posts published before a deploy are prerendered; one published afterwards
   is rendered on its first visit and kept. With cacheComponents on, an empty
   list here fails the build, so when Themis has no posts yet (or can't be
   reached at build time) one placeholder slug is prerendered instead; it
   renders the 404 like any unknown slug. */
export async function generateStaticParams() {
  const posts = await getPosts().catch(() => []);
  if (posts.length === 0) return [{ slug: "coming-soon" }];
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = isPostSlug(slug) ? await getPost(slug).catch(() => null) : null;
  if (!post) return { title: "Post not found", robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt || undefined,
      publishedTime: post.publishedAt,
      url: `${SITE}/blog/${post.slug}`,
      ...(post.coverUrl ? { images: [{ url: post.coverUrl, alt: post.title }] } : {}),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  if (!isPostSlug(slug)) notFound();
  const post = await getPost(slug);
  if (!post) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    datePublished: post.publishedAt,
    url: `${SITE}/blog/${post.slug}`,
    ...(post.coverUrl ? { image: post.coverUrl } : {}),
    author: { "@type": "Organization", name: PUBLISHER, url: SITE },
    publisher: { "@type": "Organization", name: PUBLISHER, url: SITE },
  };

  return (
    <main>
      <article>
        <Link href="/blog">All posts</Link>
        <h1>{post.title}</h1>
        {post.excerpt && <p>{post.excerpt}</p>}
        <p>
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
          {" · "}
          {readingMinutes(post.body)} min read
        </p>
        {post.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt="" width={1200} height={675} />
        )}
        <Markdown source={post.body} />
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </main>
  );
}
