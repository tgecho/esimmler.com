import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";
import { getPosts } from "../getPosts";

export const get = async () =>
  rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    items: (await getPosts()).map((post, index) => {
      return {
        title: post.title,
        pubDate: new Date(post.date),
        link: post.link,
        description:
          // Only show full content for the last N posts
          (index < 10 && post.content) ||
          post.summary ||
          post.description ||
          "",
      };
    }),
  });
