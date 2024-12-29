import { defineConfig, passthroughImageService } from "astro/config";
import sitemap from "@astrojs/sitemap";
import autolinkHeadings from "rehype-autolink-headings";
import slug from "rehype-slug";
import svelte from "@astrojs/svelte";
import "dotenv/config";

const { GHOST_SERVER_URL, NODE_ENV } = process.env;

if (!GHOST_SERVER_URL) {
  throw new Error("GHOST_SERVER_URL is required");
}
const GHOST_HOST = new URL(GHOST_SERVER_URL).host;

export default defineConfig({
  site:
    NODE_ENV === "production"
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
    domains: [GHOST_HOST],
  },
  compressHTML: true,
});
