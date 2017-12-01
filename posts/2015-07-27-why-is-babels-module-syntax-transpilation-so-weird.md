---
title: Why is Babel's module syntax transpilation so weird?
---

On of the stranger rough edges that comes with using ES6 (via [Babel](http://babeljs.io)/[Webpack](http://webpack.github.io)) revolves around the way Babel transpiles the new module syntax. When you use a named import, Babel's transpiled output seems almost designed to cause a bit of confusion, as it assigns the imported value to a local variable with a rather munged name.

```js
// Original code
import {foo} from 'bar'
console.log(foo)

// Babelified
var _bar = require('bar');
console.log(_bar.foo);
```

<!--more-->

<a href="https://babeljs.io/repl/#?code=import%20%7Bfoo%7D%20from%20'bar'%0Aconsole.log(foo)">Live example</a>

The insidious part of this is that it may take a while to notice. If you're using [source maps](http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/), Chrome's inspector will happily show your original code in the sources panel. This works shockingly well right up to the point at which you drop into the debugger and attempt to use one of your imported values.

```js
// What you want
foo

// What you get
Uncaught ReferenceError: foo is not defined
```

For a while a chalked this up to an oddity required to avoid namespace clashes or something. I even considered switching to "vanilla" `require(...)` syntax, if only for the sake of other team members. Then the ever illuminating [Dr. Axel Rauschmayer](http://www.2ality.com/) wrote up a post explaining [exactly what ES6 modules actually export](http://www.2ality.com/2015/07/es6-module-exports.html).

> In contrast to CommonJS modules, ES6 modules export bindings, live connections to values.

He goes on to give a deeper explanation, but the gist of it is that values imported via ES6 module syntax remain bound to their source. In our case, the imported `foo` is still bound to the `foo` in the `bar` module. If something mutates `foo` in the source module, our local version will update accordingly. This binding only goes one way, so attempting to change the value of `foo` locally will cause an error.

With that, the name munging mystery becomes a bit less mysterious. To mimic the behavior of a live binding, Babel must replace every instance of `foo` in your local scope with a reference to a property on the `bar` object. If anything over in `bar` causes the value of `foo` to change, the local code will pick up the change immediately.

<table>
  <tr>
    <th>Original code</th>
    <th>Babelized</th>
  </tr>

  <tr><td colspan="2"><b>bar.js</b>: `foo` is created</td></tr>
  <tr><td class="highlight-inline"><pre>
export var foo = 1</pre>
  </td>
  <td class="highlight-inline"><pre>
var foo = 1;
exports.foo = foo;</pre>
  </td></tr>

  <tr><td colspan="2"><b>local.js</b>: `foo` is imported</td></tr>
  <tr><td class="highlight-inline"><pre>
import {foo} from 'bar'
assert(foo === 1)</pre>
  </td>
  <td class="highlight-inline"><pre>
var _bar = require('bar');
assert(_bar.foo === 1);</pre>
  </td></tr>

  <tr><td colspan="2"><b>bar.js</b>: `foo` is modified</td></tr>
  <tr><td class="highlight-inline"><pre>
foo = 2</pre>
  </td>
  <td class="highlight-inline"><pre>
exports.foo = foo = 2;</pre>
  </td></tr>

  <tr><td colspan="2"><b>local.js</b>: the value of `foo` reflects the change in bar.js</td></tr>
  <tr><td class="highlight-inline"><pre>
assert(foo === 2)</pre>
  </td>
  <td class="highlight-inline"><pre>
assert(_bar.foo === 2);</pre>
  </td></tr>
</table>

I'm still not sure if I'm happy with the debugging tradeoff (especially when it affects other collaborators), but there's no question that this is a deviously pragmatic attempt to match the subtle semantics of the actual spec. Many kudos are due to [Sebastian McKenzie](https://twitter.com/sebmck) and the contributors to [Babel](https://github.com/babel/babel) for their valiant efforts to bring us these wonderful goodies from the future.

Looking forward, [Nick Fitzgerald](http://fitzgeraldnick.com/) is among those working to [improve source maps](http://fitzgeraldnick.com/weblog/63/), hopefully in ways that will help to reduce some of the impedance mismatches inherent in mixing multiple languages in a single runtime.
