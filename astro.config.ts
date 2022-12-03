import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import autolinkHeadings from "rehype-autolink-headings";

// https://astro.build/config
export default defineConfig({
  site: "https://esimmler.com",
  integrations: [mdx(), sitemap()],
  markdown: {
    extendDefaultPlugins: true,
    rehypePlugins: [[autolinkHeadings, { behavior: "wrap" }]],
  },
});
