+++
title = "Digging a pit of success for web development (draft)"
date = 2020-07-02
draft = true
+++

In ["Second-guessing the modern web"](https://macwright.org/2020/05/10/spa-fatigue.html), Tom MacWright covers many of the misgivings I've long had with the state of modern web development.

**TLDR (in my words):** The current API-backed "single-page app" architecture has a number of fundamental disadvantages and the layers we keep adding in an attempt to address them are adding to the complexity without really fixing the problems.

We should not fall into the trap of unconditionally saying that the "old ways" were just fine. Full page loads are fine for many content focused sites, but these newer patterns came in response to legitimate needs.

I spent the early part of my career striving for a strict seperation of styling, behavior and data. Tables for layout were bad, [CSS was zen](http://www.csszengarden.com/). Much of this philosophy was good and necessary, but certain aspects have not aged well. One huge downside to strict seperation of concerns along technological lines is that we inevitably moved from explicit to implicit coupling.

Let's dive down into something concrete:

```html
<form action="/hello.php">
  <button color="red">Say Hello</button>
</form>
```

This is pretty straightforward. It doesn't require any fancy Javascript or even CSS to show up. It also depends on the server to provide any logic not built into native browser form controls.

To speed things up, we might sprinkle in some rudimentary scripting.

```html
<script>
  function hello() {
    alert("Hello World!");
  }
</script>

<button onclick="hello()" color="red">Say Hello</button>
```

Now it's fast! However, we have behavior mixed directly into our presentation layer. We're also working in a global namespace, so we need to be extra careful that **nothing** else on the page creates a conflicting Javascript function.

Doing anything more complicated in a cross browser fashion got painful fast, so we'll jump ahead to the jQuery era:

```html
<script>
  $(".hello").click(function () {
    alert("Hello World!");
  });
</script>

<style>
  .hello {
    color: red;
  }
</style>

<button class="hello">Say Hello</button>
```

So now we've "separated" our content, behavior and style. We can drop a `.hello` button anywhere and it will become magically empowered to greet us **IF** the correct script is evaluated before we click it **AND** we don't typo the class name.

We've also hit a problem that does not have an obvious solution even today: What if the script doesn't load? We have a dead button. So we embrace progressive enhancement and retain the original `form` element.

```html
<script>
  $(".hello").click(function (ev) {
    ev.preventDefault();
    alert("Hello World!");
  });
</script>

<style>
  .hello {
    color: red;
  }
</style>

<form action="/hello.php">
  <button class="hello">Say Hello</button>
</form>
```

We have to do some mild duct taping to prevent the native form behavior. We also now have two separate code paths, both of which should function (and be tested!) to a minimum acceptable level.

Note that everything here is tied together with string. As in the actual string: `"hello"`. We also need to manage our dependencies, typically by making sure one or more external script files are included on the page _in the correct order_.

I'll attempt a slightly more involved example to expect the point:

```html
<script>
  $(".tabset .tabs a").click(function (ev) {
    ev.preventDefault();
    var tab = $(ev.target).data("tab");
    $("[data-content]").each(function () {
      var $el = $(this);
      if ($el.data("content") === tab) {
        $el.addClass("active");
      } else {
        $el.removeClass("active");
      }
    });
  });
</script>

<style>
  /* ... a bunch of styles to make the tabs pretty ... */
  .tabset .content {
    display: none;
  }
  .tabset .content.active {
    display: block;
  }
</style>

<div class="tabset">
  <div class="tabs">
    <a href="#" data-tab="one">One</a>
    <a href="#" data-tab="two">Two</a>
  </div>
  <div class="content active" data-content="one">I'm One!</div>
  <div class="content" data-content="two">I'm Two!</div>
</div>
```

If you'll excuse my rusty jQuery, I think this is a fairly typical, if crude representation of how things might have been done back in the day. Note the tight, but implicit coupling between all of the pieces. Note the connections between multiple kinds of strings and namespaces (CSS selectors, data attributes, etc...). Note the fun oddities such as the [`href="#"`](https://stackoverflow.com/questions/2800187/what-is-it-when-a-link-has-a-pound-sign-in-it) links (which were never actually a great idea).

Note that this is probably also mixed up in a server side templating language, meaning there are likely to be _four or more_ technologies that must be perfectly aligned in order for these tabs to function correctly.

How might this be made into a portable, reusable component? Setting aside the sloppy selectors, there isn't really a great way to avoid requiring an implementer to write a bunch of HTML _just so_ before executing your little script. They also need to make sure the CSS is loaded and evaluate the script _after_ the elements are mounted in the DOM. Or they can concat it all and always be afraid to remove anything for fear of breaking an implicit dependant.

Let's leap forward a few generations to cutting edge React:

```jsx
const Tab = styled.a`
  /* ... a bunch of styles to make the tabs pretty ... */
`;

function Tabset(props) {
  const [tab, setTab] = useState(0);

  return (
    <div>
      <div>
        {props.tabs.map((tab, index) => (
          <Tab onClick={() => setTab(index)} key={index}>
            {tab.name}
          </Tab>
        ))}
      </div>
      {props.tabs[tab].content}
    </div>
  );
}

<Tabset
  tabs={[
    { name: "One", content: <div>I'm one!</div> },
    { name: "Two", content: <div>I'm two!</div> },
  ]}
/>;
```

Setting aside (for now) the dependency on a big pile of build tooling and other problems, this approach has a number of nice properties:

1. We haven't loosely tied a pile of very different technologies together with string.
1. Our state is explicitly managed in one place.
1. Patterns of reuse are standard and idiomatic.
1. Since it's all in one common language environment, it's actually quite plausible to use [static types](https://www.typescriptlang.org/).

It's far from perfect, but hopefully we can agree that the appeal is understandable.

The problem, as I see it, is that there is no viable middle ground. Some say that you should use the right tool for the job, but where are the lines and how do you straddle them?

Do you use "traditional" server-side rendering for 80% of your app and then escalate to a fancy Javascript framework only when appropriate? How do you maintain consistent styling between the two worlds? How do you move data between them? How do you avoid getting into yet another tangle of stringly typed interfaces between disparate technologies?

These are all "solveable" problems, in the sense that they can be overcome by _just_ writing more code. Maybe. At least, so long as everyone involved can understand how it all fits together well enough to function.

There are a few interesting ideas floating around, such as [Turbolinks](https://github.com/turbolinks/turbolinks) (load new content without reloading the page), [Stimulus](https://stimulusjs.org/handbook/origin) (a different approach to adding .js behavior to elements), [Pheonix LiveView](https://www.phoenixframework.org/)/[Blazor](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor) (server-rendered with a websocket connection for fast/live client updates).

Nothing I've found so far really resonates with me. To be viable, any alternate approach can't regress too much on many of the quality of life improvements that the current patterns have brought.

I don't really have a conclusion, so... bye!
