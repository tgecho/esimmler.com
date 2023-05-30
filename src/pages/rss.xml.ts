import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";
import { byDate } from "../util/byDate";
import { getLink } from "../util/getSlug";
import { getSummary } from "../util/getSummary";
import { markdown } from "@astropub/md";

export async function get() {
  const posts = (await getCollection("blog")).sort(byDate);
  const items = (await posts).map(async (post, index) => {
    const content = await markdown(index < 10 ? post.body : getSummary(post));
    return {
      title: post.data.title,
      pubDate: post.data.date,
      link: getLink(post),
      // @astro/rss encodes html in `content` and removes CDATA from customData...
      // If we double it up it seems to only strip one :/
      // https://github.com/withastro/astro/issues/5677
      // Need to be sure to check this on the next version change.
      customData: `<description><![CDATA[<![CDATA[${content}]]]]></description>`,
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
