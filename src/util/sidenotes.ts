export function wrapSidenotes(html: string) {
  let index = 1;
  return html.replace(/\[(?:>|&gt;)([^\]]+)\]/g, (_, content) => {
    return sidenote(index++, content.trim());
  });
}

function sidenote(index: number, content: string) {
  return [
    `<label for="sidenote-${index}" tabindex="-1" onclick="blur()">`,
    `<span aria-hidden="false">Sidenote ${index}</span>`,
    `<span aria-hidden="true">${index}</span>`,
    `</label>`,
    `<input type="checkbox" id="sidenote-${index}" aria-hidden="true" tabindex="-1" />`,
    `<small data-sidenote="${index}" role="complementary">${content}</small>`,
  ].join("");
}
