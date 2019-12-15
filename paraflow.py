import inspect


def run(func, completed=None, scope=None):
    """
    Call the given function, recursively resolving and calling dependencies by
    matching parameter names to functions in the caller's scope (or one provided).

    Usage Example:
        ```
        def one():
            return 1

        def two(one):
            return one == 1

        if __name__ == "__main__":
            assert run(two) == True
        ```

    Optional Arguments:
        completed
            A prepopulated dictionary mapping functions to their result values.
            Note that the key is the function object itself, NOT the string name.
            Any existing results found here will be used in lieu of calling the
            original function.

            The main usage for this is caching intermediate results between
            multiple run(...) calls.

        scope
            A name keyed dictionary containing available functions.
    """
    if completed is None:
        completed = {}
    if scope is None:
        scope = inspect.currentframe().f_back.f_locals
    completed = {} if completed is None else completed
    scope = inspect.currentframe().f_back.f_locals if scope is None else scope

    if func not in completed:
        deps = [scope[p] for p in inspect.signature(func).parameters]
        args = [run(d, completed=completed, scope=scope) for d in deps]
        completed[func] = func(*args)

    return completed[func]
