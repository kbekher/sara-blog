import { siteLocaleTag } from "@/lib/i18n/config";
import { getFeedPosts } from "@/lib/posts/public-queries";
import { site } from "@/lib/site";
import { absoluteUrl, RSS_PATH } from "../_lib/seo";

/** XML-escapes text content and attribute values. */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** CDATA cannot contain "]]>", so split it across two sections. */
function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** Makes root-relative src/href in post HTML absolute so feed readers can resolve them. */
function absolutizeHtml(html: string): string {
  return html.replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${absoluteUrl("/")}`);
}

/** RSS 2.0 feed with full post content. Cached via the post queries (tag "posts"). */
export async function GET() {
  const posts = await getFeedPosts();

  const home = absoluteUrl("/");
  const self = absoluteUrl(RSS_PATH);
  const lastBuild = posts.reduce<Date | null>((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), null);

  const items = posts
    .map((post) => {
      const link = absoluteUrl(`/posts/${post.slug}`);
      const cover = post.cover
        ? `<p><img src="${xml(post.cover.url)}" alt="${xml(post.cover.alt)}" /></p>`
        : "";
      return [
        "<item>",
        `<title>${xml(post.title)}</title>`,
        `<link>${xml(link)}</link>`,
        `<guid isPermaLink="true">${xml(link)}</guid>`,
        `<pubDate>${post.publishedAt.toUTCString()}</pubDate>`,
        `<dc:creator>${xml(site.author)}</dc:creator>`,
        post.excerpt ? `<description>${cdata(post.excerpt)}</description>` : "",
        ...post.tags.map((t) => `<category>${xml(t.name)}</category>`),
        `<content:encoded>${cdata(cover + absolutizeHtml(post.contentHtml))}</content:encoded>`,
        post.cover ? `<media:content url="${xml(post.cover.url)}" medium="image" />` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${xml(site.name)}</title>
<link>${xml(home)}</link>
<description>${xml(site.description)}</description>
<language>${siteLocaleTag}</language>
<atom:link href="${xml(self)}" rel="self" type="application/rss+xml" />
<generator>Next.js</generator>
${lastBuild ? `<lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>` : ""}
${items}
</channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
