# Solution Sheet

Full implementation: `database_solution.py` (run it from the problem root: `python3 solution/database_solution.py && python3 database_check.py`).

## Key ideas

1. **Transforms as a dictionary** (`TRANSFORMS: dict[str, TransformFn]`).
   The mapping JSON refers to transforms by name only, so the spec stays pure
   data and new transforms are a one-line registration:

```python
TRANSFORMS: dict[str, TransformFn] = {
    "lowercase": lambda v: v.lower(),
    "first_word": lambda v: v.split()[0],
    "last_word": lambda v: v.split()[-1],
    "yn_to_bool": lambda v: v == "Y",
    "ddmmyyyy_to_iso": lambda v: "-".join(reversed(v.split("/"))),
}
```

2. **Nested targets via `setdefault`**. Split the dotted key, walk/create the
   parent dicts, assign at the leaf:

```python
*parents, leaf = dotted_key.split(".")
for key in parents:
    record = record.setdefault(key, {})
record[leaf] = value
```

3. **One resolution order per field**: source → transform → default.
   `legacy.get(...)` returns `None` for missing fields, which routes into the
   default branch — transforms only ever see real values (rule 3):

```python
value = legacy.get(spec["source"]) if "source" in spec else None
if value is None:
    value = spec.get("default")
elif "transform" in spec:
    value = TRANSFORMS[spec["transform"]](value)
```

4. **Dropping deprecated fields is free** — the output is built from the
   mapping's keys, never the legacy record's, so `fax` simply never appears.

## Common mistakes

- Applying transforms to defaults (rule 3 says don't).
- Iterating the legacy record's keys instead of the mapping's — breaks rules 3 and 4.
- `last_word` failing on 3-part names like "Grace Brewster Hopper" (use `split()[-1]`, not `split()[1]`).
- Hand-parsing dates; `"-".join(reversed(v.split("/")))` is all `ddmmyyyy_to_iso` needs.

## Expected gotchas in the data

- User 102: three-word name, mixed-case email, `is_active: "N"` → `false`.
- User 103: no `addr_city` → `address.city: null` (no default given).
- `plan` has no source at all → always `"free"` via default.
