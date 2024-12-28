import { defineConfig, passthroughImageService } from "astro/config";
import sitemap from "@astrojs/sitemap";
import autolinkHeadings from "rehype-autolink-headings";
import slug from "rehype-slug";
import svelte from "@astrojs/svelte";

export default defineConfig({
  site:
    process.env.NODE_ENV === "production"
      ? "https://esimmler.com/"
      : "http://localhost:4321",
  integrations: [
    sitemap({
      serialize(item) {
        item.url = item.url.replace(/\/$/, "");
        return item;
      },
    }),
    svelte(),
  ],
  markdown: {
    rehypePlugins: [
      // Normally astro would inject the ids, but apparently it doesn't happen
      // until AFTER the autolink plugin runs, so let's do that ourselves:
      // https://github.com/withastro/astro/issues/5001
      slug,
      [
        autolinkHeadings,
        {
          behavior: "wrap",
        },
      ],
    ],
  },
  build: {
    inlineStylesheets: `auto`,
  },
  image: {
    service: passthroughImageService(),
    domains: ["marvin.local"],
  },
  compressHTML: true,
});
