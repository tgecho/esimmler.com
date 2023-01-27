---
title: "React components are first class"
date: "2015-06-09"
---

React components have a surprisingly simple property which sets them apart from the equivalents in other frameworks. Rather then being specified by name in a string based template, they're referenced as a value in Javascript.

```js
import Hello from "./Hello";
<Hello>World</Hello>;
```

Since the name of the tag is actually just the name of a local variable, component references can be dynamically calculated, passed into other components as props and even manufactured on the fly.

The closest equivalent in Angular would be a directive, which are stored in an app wide namespace (along with directives from third party modules) and referenced by name.

```html
<!-- "hello" was registered elsewhere as a directive -->
<hello>World</hello>
```

Avoiding namespace clashes is a relatively superficial advantage, but components as first class Javascript objects open up a huge amount of flexibility and composability. Observe a simple case of dynamically selecting a component in React:

```js
const DynamicFoo = React.createClass({
  render() {
    const Foo = selectAFoo(this.props.type);
    return <Foo>Bar</Foo>;
  },
});
```

The simplest equivalent I can devise in Angular (without writing some sort of generic helper directive) is this:

```js
app.directive("dynamicFoo", [
  "$compile",
  function ($compile) {
    return {
      scope: {
        type: "=",
      },
      link(scope, element, attrs) {
        // Without this watch, it won't update the
        // component type after the initial render.
        scope.$watch("type", function (type) {
          const foo = selectAFoo(scope.type);

          // This would be a bit nastier without template literals!
          element.html(`<${foo}>Bar</${foo}>`);
          $compile(element.contents())(scope);
        });
      },
    };
  },
]);
```

Under all of that boilerplate, we're really _just_ creating a dynamic template on the fly via string munging. It's not so bad in the case of a simple name swap, but what about dynamic attributes in React?

```js
<Foo {...dynamicProps}>Bar</Foo>
```

The following Angular version isn't robust enough to seriously consider using in production for any number of reasons (hopefully obvious to experienced Angular developers), but it's the simplest naive approach I can come up with.

```js
const combined = dynamicProps.map((v, k) => `k="${v}"`).join(" ");
// turns {one: 1, two: 2} into 'one="1" two="2"'
element.html(`<foo ${combined}>Bar</foo>`);
```

It's also rather gross, while the React version is idiomatic.

The relative simplicity of React's API does not come at the cost of power. In fact, its regularity and conceptual integrity enable a ton of useful patterns. Don't be so quick to jump into "sophisticated" registry patterns when the humble variable has so much to offer.
