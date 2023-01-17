---
title: "Adding constraints to Canrun, a logic programming library for Rust"
---

_Be sure to have read [Building Canrun: A statically typed logic programming library for Rust (part 1)](@/2020-07-08-building-canrun-part-1.md)_ to put this article in context. Also see my [update post with more recent API/implentation notes](./TODO).

I had static types. I had a potentially novel Rust flavored approach to managing `State`. Alongside this work[^timelines], I was plotting my next move: trying to bolt on a [constraint system](https://en.wikipedia.org/wiki/Constraint_logic_programming).

In basic [μKanren](http://webyrd.net/scheme-2013/papers/HemannMuKanren2013.pdf)[^interpretation], any interactions between values occur through unification. While impressive results can be achieved with a bit of creativity (see: [math with Peano numbers](https://codon.com/hello-declarative-world#numbers)), I wanted something more direct, understandable and arbitrarily powerful. I like my toys to at least have a veneer of practicality.

Take some simple arithmetic:

```rust
let left = LVar::new();
let right = LVar::new();
let result = LVar::new();
//            left + right = result`
let goal = add(left, right, result);
```

We have three variables representing the two numbers to be added, and the result. We want to be able to derive any one of these values so long as the other two numbers have been resolved.

Enter constraints. A constraint is a way to register a function to be called when one or more `Value`s are resolved. The first part is a [`Constraint`](https://docs.rs/canrun/latest/canrun/core/constraints/trait.Constraint.html) trait, which as of this moment looks like this
```rust
pub trait Constraint {
    fn attempt(&self, state: &State) -> Result<ResolveFn, LVarList>;
}
```

When added to a `State`, the constraint's `attempt()` method is immediately run. It is given readonly access to `&State` to allow resolving values. If it collects enough, it can return a boxed `FnOnce(State) -> Option<State>` which is where it can actually operate on the state.

So for example, if `left` and `right` have been resolved, our `add` constraint might return something like this:
```rust
Box::new(|state| {
	let result_resolved = Value::new(left_resolved + right_resolved);
	//                                             ^ the actual addition!
	state.unify(&result_var, &result_resolved)
})
```

If it can't collect enough resolved values, it can return an `Err(lvarlist)` containing the variables it's waiting on. When this happens, the constraint goes dormant until one of these variables is resolved in a later step.

Constraints are stored in a special [`HashMap`/`HashSet` combo](https://github.com/tgecho/canrun_rs/blob/negation/canrun/src/core/mkmvmap.rs) (TODO: update this link) that allows multiple keys (the watched vars) to be associated with multiple values (the constraints). Whenever a previously unresolved variable is unified with a value, we look it up and run any pending constraints.



---

[^timelines]: All timelines, implied or otherwise, are not meant to be taken literally. Believe it or not, this rambling mess is the result of an attempt to err on the side of understandability over historical accuracy.

[^interpretation] As always, anything I say about *Kanren or... really anything I say should be taken with a grain of salt. As I've rambled at a few formerly close friends, this is applied science without the science, or to be honest even much application.