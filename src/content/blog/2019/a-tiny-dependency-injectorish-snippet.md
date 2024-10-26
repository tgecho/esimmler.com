---
title: "A tiny dependency injectorish snippet"
date: "2019-12-15"
tags: ["python"]
---

My favorite [pytest](https://docs.pytest.org/) feature is its support for ["funcarg" fixtures](https://docs.pytest.org/en/latest/fixture.html#fixtures-as-function-arguments), a lightweight approach to wiring up data flow. Years ago, I even wrote [a small library](https://github.com/tgecho/pipedream) targeted at more generic usage. It was a fun experience, but most of the Python I've written lately is in the form of small scripts. In that context, it's often convenient to avoid extra dependencies.

To that end, I've been using a minimal implementation of the concept in a few places.

<!-- more -->

```py
# License: MIT (http://opensource.org/licenses/MIT)

import inspect

def run(func, completed=None, scope=None):
    completed = {} if completed is None else completed
    scope = inspect.currentframe().f_back.f_locals if scope is None else scope

 if func not in completed:
        deps = [scope[p] for p in inspect.signature(func).parameters]
        args = [run(d, completed=completed, scope=scope) for d in deps]
        completed[func] = func(*args)

 return completed[func]
```

It's small enough to copy/paste into the bottom of a script (or drop the file in a directory if you're sharing). Usage is simple, and doesn't require spreading a special decorator around.

```py
def one():
 return 1

def two(one):
 return 1 + one

if __name__ == "__main__":
 assert(run(two) == 2)
```

Only required functions are evaluated, and results are cached so that each is only run once.

Despite the small size, there's actually a fair amount of inherent flexibility. You can pass in a custom dictionary of functions.

```py
def two(one):
 return 1 + one

if __name__ == "__main__":
 assert(run(two, scope={'one': lambda: 1}) == 2)
```

You can also pre-populate the dictionary of resolved values, allowing reuse between runs or other use cases.

```py
def two(one):
 return 1 + one

if __name__ == "__main__":
 # Note that the key is the actual function rather than just the name as a string
 assert(run(two, completed={one: 1}) == 2)
```

I would not suggest architecting a non-trivial app around this little snippet. It is sure to have dark corners, it doesn't attempt to cover many edge cases, and the indirection has potential to confuse unwitting visitors. However, if your task is complex enough to benefit from being able to wire up a little dependency graph and this style brings you joy, feel free to copy/paste it and go to town.
