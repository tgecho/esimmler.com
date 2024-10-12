import rss from "@astrojs/rss";
import { getCollection, type CollectionEntry } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";
import { byDate } from "../util/byDate";
import { getLink } from "../util/getSlug";
import { getSummary } from "../util/getSummary";

export async function GET() {
  const postsPrefixLength = "../content/blog/".length;
  const postImportResult = import.meta.glob("../content/blog/**/*.md", {
    eager: true,
  });
  const rawPostsById = Object.fromEntries(
    Object.entries(postImportResult).map(([key, value]) => [
      key.slice(postsPrefixLength),
      value,
    ]),
  ) as Record<string, { compiledContent: () => string }>;

  function getCompiledContent(post: CollectionEntry<"blog">) {
    const rawPost = rawPostsById[post.id];
    if (rawPost) {
      return rawPost.compiledContent();
    } else {
      return getSummary(post);
    }
  }

  // console.log("postImportResult all", postImportResult);
  const posts = (await getCollection("blog")).sort(byDate);
  const items = (await posts).map(async (post, index) => {
    const description =
      index < 10 ? getCompiledContent(post) : getSummary(post);
    return {
      title: post.data.title,
      pubDate: post.data.date,
      link: getLink(post),
      description,
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
