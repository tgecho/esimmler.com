+++
title = "Using cursors to simplify form element data binding"
+++

In [React](https://facebook.github.io/react/), the most often cited method of binding form elements to data is to pass the value along with an update function.

```js
<input value={value} onChange={e => update(e.target.value)} />
```

This code is straightforward and explicit, but the update functions can easily become coupled to method of persisting the data change. This is especially tricky when the form element is nested a few layers deep.

<!-- more -->

Facebook's [`LinkedStateMixin`](https://facebook.github.io/react/docs/two-way-binding-helpers.html) is one early attempt to streamline this style of data binding. It still follows the basic model of value/update, but they're combined into a single object. This object is passed to form elements via the `valueLink` (or `checkedLink`) prop. React will call your object's `requestChange` method with the value of the form element whenever it changes.

```js
<input valueLink={this.linkState("foo")} />
```

The reduced boilerplate is nice, and the ability to pass a "link" around as a self contained object is even better. Unfortunately, this implementation ties you to storing data directly in state of a react component. It also doesn't play well with nested data structures. It's not a complete loss, as the `valueLink` and `checkedLink` props give us a very valuable place to insert the star of this post: cursors.

Roughly speaking, a cursor allows you to view and change a piece of data nested inside a larger data structure without mutating it directly. This allows you to decouple the triggering of a change from its persistence.

```js
const link = cursor(data, ["path"], change => {
  saveTheChange(change);
});
```

A naive, but useful cursor implementation can start out as a function that takes a data structure, an array path and a callback. It returns an object containing the value at that path and a function used to update that value. I'm leaving `getIn` and `setIn` as an exercise for the reader, but something like [Immutable.js](https://facebook.github.io/immutable-js/) makes these types of operations very natural.

```js
// getIn/setIn are left as an exercise for the reader.
function cursor(obj, path, onChange) {
  return {
    value: getIn(obj, path),
    requestChange(value) {
      onChange(setIn(obj, path, value));
    }
  };
}
```

The cursor callback receives a new copy of the original object with the relevant change applied. Ideally this would be done without mutating the original, but that's not absolutely required for the technique to have value. Your callback is responsible for persisting that change in whatever way is appropriate. In React you will often do this with `setState`. You can also trigger network requests or other relevant logic.

```js
const link = cursor(this.state, ["foo"], changed => {
  this.setState({ foo: changed });
  doSomethingElse(changed);
});
return <input valueLink={subLink} />;
```

This simple cursor makes it easy to keep state management cleanly separated from the wiring up of form elements. You can even sprinkle in bits of ad hoc transformation without jumping through hoops.

The next step is to allow cursors to create new sub cursors.

```js
function cursor(obj, path, onChange) {
  return {
    value: getIn(obj, path),
    requestChange(value) {
      onChange(setIn(obj, path, value));
    },
    sub(path) {
      return cursor(obj, path.concat(path), onChange);
    }
  };
}
```

With this, you can pass a cursor for the data of an entire form into a form component. That form can then spin off a sub cursor for each element.

```js
<input valueLink={link.sub("bar")} />
```

If your data structure is nested, you can delegate entire layers to subforms without tightly coupling their implementation.

```js
// `user` is a cursor for
// {
//   name: 'John Smith',
//   address: {
//     street: '', city: '', state: '', zip: ''
//   }
// }
<input valueLink={user.sub('name')} />
<AddressForm cursor={user.sub('address')} />
```

Cursors are a [simple](http://www.infoq.com/presentations/Simple-Made-Easy) and yet powerful concept. They make it practical to centralize state management while still allowing clean encapsulation of subcomponents. This may seem like an odd goal in a world where stateful objects are still considered the norm, but the benefits of standardized and composable data flow patterns extend beyond "exotic" functional programming languages.

## Further reading

Most of my initial exposure to these concepts was through learning about the many useful properties of immutable persistent data structures. David Nolan is one of many pioneers in this space with [Om](https://github.com/omcljs/om), a [ClojureScript](https://github.com/clojure/clojurescript) library built on React. [Cursors](https://github.com/omcljs/om/wiki/Cursors) are one of Om's foundational concepts.

There are also quite a few cursor (or cursor like) libraries with different styles and priorities. [react-cursor](https://github.com/dustingetz/react-cursor), [Omniscient](http://omniscientjs.github.io/) and [Redux](https://github.com/rackt/redux) are a few that seem to bubble up a lot. I don't have much personal experience with any of them, but they're all worth reading about.
