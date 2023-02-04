---
title: "Arrow functions and Javascript's syntactic baggage"
date: "2015-09-12"
tags: ["javascript"]
---

I recently learned two new things about Javascript. The first discovery makes me feel silly. Somehow I missed that there is a multiline form as well as the short, single line form.

```js
const short = (n) => n + 1;

const long = (n) => {
  return n + 1;
};
```

This isn't a huge paradigm shift, but it does mean that there are far fewer cases in which the old `function(){}` syntax makes sense beyond familiarity.

<!-- more -->

Next, I learned why my attempts to return an object from a shorthand arrow function always seemed to fail unhappily.

```js
const buggy = (n) => {
  value: n;
};
// returns `undefined`
```

I always instinctively fixed this by placing parens around the return value, but only just got around to digging into why this actually worked.

```js
const unbuggy = (n) => ({ value: n });
// returns an object containing `n`
```

It turns out Javascript allows you to [define a label](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/label) using `myLabel:` syntax. So my buggy example function is actually creating a multiline arrow function containing a label named `value`. Since there's no return statement, the `n` is silently dropped on the floor and the function returns `undefined`.

Now, I won't go so far as to call labels _useless_, but they're not exactly pervasive. In this case, they're definitely a bit confusing, and the bit of extra noise required to work around them makes me a bit sad. Such is life.

Language design is hard, and language evolution is harder. Anyone involved in either should be given a lot of credit, especially when they try to resist the accumulation of new syntax.
