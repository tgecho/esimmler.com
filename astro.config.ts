import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import autolinkHeadings from "rehype-autolink-headings";
import slug from "rehype-slug"

export default defineConfig({
  site: "https://esimmler.com/",
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [
      // Normally astro would inject the ids, but apparently it doesn't happen
      // until AFTER the autolink plugin runs, so let's do that ourselves:
      // https://github.com/withastro/astro/issues/5001
      slug,
      [autolinkHeadings, { behavior: "wrap" }]
    ],
  },
  vite: {
    ssr: {
      // some sub-dependencies are still using `require()`
      external: ['@astropub/md']
    }
  }
});
