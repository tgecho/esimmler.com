import { getImage } from "astro:assets";
import * as cheerio from "cheerio";

export async function processImgTags(
  $: cheerio.CheerioAPI,
): Promise<cheerio.CheerioAPI> {
  for (const img of $("img")) {
    const originalSrc = img.attribs.src;
    if (!originalSrc) continue;
    const src = await getImage({
      src: originalSrc,
      inferSize: true,
    });
    img.attribs.src = src.src;

    const originalSrcset = img.attribs.srcset;
    if (originalSrcset) {
      let srcsetEntries = [];
      for (const entry of originalSrcset.split(/\s*,\s*/)) {
        const parts = entry.split(/\s+/);
        if (!parts[0]) continue;
        parts[0] = (
          await getImage({
            src: parts[0],
            inferSize: true,
          })
        ).src;
        srcsetEntries.push(parts.join(" "));
      }
      img.attribs.srcset = srcsetEntries.join(", ");
    }
  }
  return $;
}
