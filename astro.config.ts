import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import autolinkHeadings from "rehype-autolink-headings";
import slug from "rehype-slug";
import markdownIntegration from "@astropub/md";

export default defineConfig({
  site: "https://esimmler.com/",
  integrations: [
    sitemap({
      serialize(item) {
        item.url = item.url.replace(/\/$/, "");
        return item;
      },
    }),
    markdownIntegration(),
  ],
  markdown: {
    rehypePlugins: [
      // Normally astro would inject the ids, but apparently it doesn't happen
      // until AFTER the autolink plugin runs, so let's do that ourselves:
      // https://github.com/withastro/astro/issues/5001
      slug,
      [autolinkHeadings, { behavior: "wrap" }],
    ],
  },
  build: {
    inlineStylesheets: `auto`,
  },
  compressHTML: true,
});
