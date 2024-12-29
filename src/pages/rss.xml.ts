import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";
import { allPosts, postFromSlug } from "../lib/ghost";
import { postLink, postSummary, postToHtml } from "./[post].astro";

// TODO: pull content from ghost

export async function GET() {
  const posts = await allPosts();
  const items = posts.map(async (post, index) => {
    const description = await (index < 10
      ? postToHtml(await postFromSlug(post.slug))
      : postSummary(post));
    const link = postLink(post);
    const pubDate = new Date(
      post.published_at || post.created_at || Date.now(),
    );
    return {
      title: post.title,
      pubDate,
      link,
      description: description
        ? withAbsoluteURLs(description, new URL(link, import.meta.env.SITE))
        : undefined,
    };
  });

  const feed = await rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    items: await Promise.all(items),
    trailingSlash: false,
  });

  return feed;
}

function withAbsoluteURLs(html: string, base: URL) {
  return html.replace(
    /(src|href)\s*=\s*["']([^"']+)["']/g,
    (match, attr, url) => {
      try {
        return `${attr}="${new URL(url, base)}"`;
      } catch (e) {
        console.warn(`Failed to make URL absolute: ${url}`);
        return match;
      }
    },
  );
}
