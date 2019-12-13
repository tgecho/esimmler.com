+++
title = "Simple Javascript rendering with template strings"
+++

For tiny projects, [template strings](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/template_strings) can make simple things really easy, even without using libraries.

```
const template = (title, items) => `
  <h2>${title}</h2>

  ${subtitle ? `<h3>${subtitle}</h3>` : ''}

  <ul>
    ${items.map(item => `
      <li>${item}</li>
    `).join('')}
  </ul>
`;
```
Some aspects of this may seem familiar if you've been using React. Replacing traditional template language loop constructs with `.map` takes getting used to, but the realization that you don't *need* any new language constructs is itself quite cool.

When combined with [querySelector](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector), [addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) and [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), the thought of doing small projects without large scale library support (beyond an ES6 transpiler) becomes quite reasonable.
