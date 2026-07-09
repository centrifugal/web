# Built-in identifiers (`type`, `int`, `string`, …) cannot be used/shadowed as variables, contrary to the CEL spec

## Summary

A context variable whose name matches a standard-library identifier such as `type` cannot be
referenced. Expressions like `type == "pub"` fail — at evaluation, at type-checking, and there is
no way to register the variable either. Per the CEL specification these names are **not** reserved
keywords: they are standard-library identifiers that user bindings are explicitly allowed to shadow.

Version: `@marcbachmann/cel-js@8.0.0`

## Reproduction

```js
import { evaluate, parse, check, Environment } from '@marcbachmann/cel-js'

const ctx = { type: 'pub', pub: { data: { input: 'hello' } } }

// 1. evaluate() throws
evaluate('type == "pub"', ctx)
// => EvaluationError: no such overload: type == string

// 2. check() reports it invalid
check('type == "pub"')
// => { valid: false, error: { name: 'TypeError' } }

// 3. parse() produces a function that also throws when called
parse('type == "pub"')(ctx)
// => EvaluationError: no such overload: type == string

// 4. Registering the variable is rejected too
new Environment().registerVariable('type', 'dyn')
// => Error: Invalid variable declaration: 'type' is already registered
```

Note that a non-colliding field works as expected — so the problem is specific to names that clash
with standard-library identifiers:

```js
evaluate('pub.data.input == "hello"', ctx) // => true
```

## Expected behavior

`type == "pub"` should resolve `type` from the provided context (`'pub'`) and evaluate to `true`,
matching other conformant implementations (e.g. `cel-go`, the reference implementation).

## Why this is spec-conformant

The CEL language definition
([`cel-spec/doc/langdef.md`](https://github.com/google/cel-spec/blob/master/doc/langdef.md))
distinguishes **grammar-reserved keywords** from **standard-library identifiers**:

- Reserved (may not be used as identifiers):
  `as break const continue else for function if import let loop package namespace return var void while`,
  plus the keywords `true false null in`.
- `type`, `int`, `uint`, `double`, `bool`, `string`, `bytes`, `list`, `map`, `dyn` are **type
  denotations** bound in the standard environment. They are regular identifiers that happen to be
  predefined, and the spec states they _can be shadowed by user bindings_.

So treating `type` (and the other type-name identifiers) as non-overridable built-ins is stricter
than the spec allows.

## Impact

Any application that evaluates expressions over data with a field named `type` (a very common field
name) cannot use this library — the field is unreachable and there is no escape hatch. The same
applies to data keyed by `int`, `string`, `map`, etc.

## Suggested direction

Allow a value present in the evaluation context (and/or `registerVariable`) to shadow a
standard-library type-denotation identifier. Concretely, one of:

1. Make variable resolution prefer a context/registered binding over the built-in type value when
   the name collides (spec-conformant default).
2. Allow `registerVariable('type', ...)` to override the built-in instead of throwing
   `'type' is already registered`.
3. If a fully permissive default is undesirable, expose an option
   (e.g. `new Environment({ allowBuiltinShadowing: true })`, or extend the existing
   `unlistedVariablesAreDyn` semantics to cover type-denotation identifiers) so callers can opt in.

Happy to help with a test case or PR if a direction is agreed on.
