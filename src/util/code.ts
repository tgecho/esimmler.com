import * as cheerio from "cheerio";
import { codeToHtml } from "shiki";

export async function highlightCodeBlocks(html: string): Promise<string> {
  const $ = cheerio.load(html);
  for (const element of $("pre").has("code")) {
    const code = $(element).find("code");
    const lang = $(code).attr("class")?.replace("language-", "") || "text";
    const highlighted = await codeToHtml(code.text(), {
      lang,
      theme: "vitesse-light",
    });
    $(element).replaceWith(highlighted);
  }
  return $.html();
}
