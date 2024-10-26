---
title: "Dynamic React animations"
date: "2015-06-25"
tags: ["react"]
---

Did you know that you can dynamically change the transitionName of a [React](http://facebook.github.io/react/) animation on the fly? This is more of a "hey look it works" thing then an actual revelation.

<!-- more -->

First, a quick primer/review taken from the [React animation docs](https://facebook.github.io/react/docs/animation.html). The `CSSTransitionGroup` automatically adds classes to its children when they are added and removed.

```js
<CSSTransitionGroup transitionName="example">{items}</CSSTransitionGroup>
```

In this case, a new item will be rendered with the `.example-enter` class. Immediately after render, the `.example-enter-active` class will be added.

By adding some matching CSS, you can cause the entry to be animated using CSS transitions.

```css
.example-enter {
  opacity: 0.01;
  transition: opacity 0.5s ease-in;
}
.example-enter.example-enter-active {
  opacity: 1;
}
```

`CSSTransitionGroup` also adds similar classes when elements leave.

## Making the transition name dynamic

One cool aspect of `CSSTransitionGroup` is that you can adjust the name on the fly. Among many possibilities, this makes it very easy to dynamically control the direction of a sliding transition.

```js
<CSSTransitionGroup transitionName={`slide-${direction}`}>
  {items}
</CSSTransitionGroup>
```

In my case, I was dealing with a navigation component in which you could drill to various depths. Setting the name is simple, but calculating the desired direction requires a bit of state.

```js
React.createClass({
  // ...
  componentWillReceiveProps(newProps) {
    // `path` is an array of tree node indexes
    const direction =
      newProps.path.length > this.props.path.length ? "right" : "left";
    this.setState({ direction });
  },
  render() {
    // ...
    return (
      <CSSTransitionGroup transitionName={`slide-${this.state.direction}`}>
        {/* ... nav pane ... */}
      </CSSTransitionGroup>
    );
  },
});
```

This isn't bad, but I wanted to extract the state and moving parts into a self contained component. With this final product, the only prop you need to pass in is a numeric representation of your depth. The panes will slide transition from right to left as if moving forward when the number increases and vice versa when it decreases.

```js
<SlideTransition depth={path.length}>{/* ... nav pane ... */}</SlideTransition>
```

The source of the final component is available in a [Gist](https://gist.github.com/tgecho/4332a21f4d2df4ce3725) as well as in the [CodePen demo](http://codepen.io/tgecho/pen/waeLNb) embedded below.

<p data-height="300" data-theme-id="16276" data-slug-hash="waeLNb" data-default-tab="result" data-user="tgecho" class='codepen'>See the Pen <a href='http://codepen.io/tgecho/pen/waeLNb/'>Directional React Animations</a> by tgecho (<a href='http://codepen.io/tgecho'>@tgecho</a>) on <a href='http://codepen.io'>CodePen</a>.</p>
<script async src="//assets.codepen.io/assets/embed/ei.js"></script>
