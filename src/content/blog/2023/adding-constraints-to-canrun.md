---
title: "Adding constraints to Canrun"
date: "2023-01-24"
tags: ["rust", "canrun"]
summary: "In basic μKanren, values interact through unification. While impressive results can be achieved with a bit of creativity (see: math with Peano numbers), I wanted something more direct, understandable and arbitrarily powerful. I like my toys to have at least a veneer of practicality."
---

_Be sure to read [Building Canrun: A statically typed logic programming library for Rust](/building-canrun-part-1) to put this article in context. Also see my [update post with more recent API/implementation notes](/simplifying-a-toy-logic-programming-library)._

In basic [μKanren](http://webyrd.net/scheme-2013/papers/HemannMuKanren2013.pdf), values interact through unification[^interpretation]. While impressive results can be achieved with a bit of creativity (see: [math with Peano numbers](https://codon.com/hello-declarative-world#numbers)), I wanted something more direct, understandable and arbitrarily powerful. I like my toys to have at least a veneer of practicality.

<!-- more -->

Take some simple arithmetic:

```rust
let left = LVar::new();
let right = LVar::new();
let result = LVar::new();
//            left + right = result`
let goal = add(left, right, result);
```

We have three variables representing the two numbers to be added and the result. We want to be able to derive any one of these values so long as the other two numbers have been resolved. Enter constraints.

A constraint is a way to register a function to be called when one or more `Value`s are resolved. The first part is a [`Constraint`](https://docs.rs/canrun/latest/canrun/core/constraints/trait.Constraint.html) trait, which as of this moment looks like this:

```rust
pub trait Constraint {
    fn attempt(&self, state: &State) -> Result<ResolveFn, LVarList>;
}
```

When passed into [`State::constrain()`](https://docs.rs/canrun/latest/canrun/core/struct.State.html#method.constrain), the constraint's `attempt()` method is immediately run with readonly access to `&State` so it can resolve values. If it resolves enough of them, it can return a boxed `FnOnce(State) -> Option<State>` function which will be called to actually update the state.

So for example, if `left` and `right` have been resolved, our `add` constraint might return something like this:

```rust
Box::new(|state| {
	let result_resolved = Value::new(left_resolved + right_resolved);
	//                      the actual addition! --^
	state.unify(&result_var, &result_resolved)
})
```

If any required values are not yet resolved, it can return an `Err(lvarlist)` containing the variables it's waiting on. When this happens, the constraint goes dormant until one of these variables is hopefully resolved at a later time.

Constraints are stored in a special [`HashMap`/`HashSet` combo](https://github.com/tgecho/canrun_rs/blob/main/canrun/src/core/mkmvmap.rs) that allows multiple keys (the watched vars) to be associated with multiple values (the constraints). Whenever a previously unresolved variable is unified with a value, we look it up and run any pending constraints.

This interface was the best balance I could devise between efficiency, precision and succinctness (on the part of the library user), but it's still somewhat subtle to get right as a [Constraint](https://docs.rs/canrun/latest/canrun/core/constraints/trait.Constraint.html) implementer. So I built [a set of constraint/projection helpers](https://docs.rs/canrun/latest/canrun/goals/project/index.html) that (so far) seem to cover most of the use cases I've encountered.

These primitive helpers are used build out various higher level goal functions, including basic [comparison](https://docs.rs/canrun/latest/canrun/goals/cmp/index.html), [math](https://docs.rs/canrun/latest/canrun/goals/ops/index.html) and [collection helpers](https://docs.rs/canrun/latest/canrun/collections/index.html).

One area I'm struggling with is how to handle unresolved constraints when you attempt to resolve or even [reify](https://docs.rs/canrun/latest/canrun/core/trait.Reify.html) values. As long as there are pending constraints (or forks!), no value you extract can be considered final. For now, I've taken a very conservative approach when you use the [query](https://docs.rs/canrun/latest/canrun/core/trait.Query.html) system where any leaf states with unresolved constraints will be omitted completely. I'd like to figure out a nice way to allow inspecting these sorts of situations.

All in all, unify/fork/constrain seem like a really solid core combo on which to build higher level abstractions.

---

[^interpretation]: As always, anything I say about \*Kanren or... really anything I say should be taken with a grain of salt. As I've rambled at a few formerly close friends, this is applied science without the science, or to be honest even much application.
