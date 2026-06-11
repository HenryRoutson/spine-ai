# Test Problem: Field-Mapping Driven Database Migration

You are migrating a legacy CRM `users` table to a new schema. Writing one-off
migration code per field doesn't scale, so the migration must be **driven
entirely by a mapping dictionary** loaded from JSON.

## Inputs

- `data/database_legacy_users.json` — list of legacy records (messy field names, string booleans, `DD/MM/YYYY` dates, deprecated fields like `fax`).
- `data/database_field_mapping.json` — the mapping spec. Each entry maps a **target field** to a spec dict:

```json
"target_field": {
  "source": "LEGACY_FIELD",   // optional: legacy field to read from
  "transform": "name",        // optional: transform to apply to the value
  "default": "value"          // optional: used when source is missing/absent
}
```

## Rules

1. Build each output record purely from the mapping spec — no hardcoded field names in your migration logic.
2. A dot in the target field name (e.g. `address.city`) means a **nested** object in the output.
3. If the legacy value is missing (`source` absent from the record, or no `source` given), use `default` if present, otherwise `null`. Transforms are never applied to defaults.
4. Legacy fields not mentioned in the mapping (e.g. `fax`) are dropped.
5. Implement these transforms (registered in a dictionary, name → function):
   - `lowercase` — `"Ada@X.COM"` → `"ada@x.com"`
   - `first_word` — `"Grace Brewster Hopper"` → `"Grace"`
   - `last_word` — `"Grace Brewster Hopper"` → `"Hopper"`
   - `yn_to_bool` — `"Y"` → `true`, anything else → `false`
   - `ddmmyyyy_to_iso` — `"15/03/2021"` → `"2021-03-15"`

## Task

Complete `database_starter.py` so it reads both JSON files and writes the
migrated records to `database_output.json`. Then verify:

```bash
python3 database_starter.py && python3 database_check.py
```

Solution sheet: `solution/database_SOLUTION.md` and `solution/database_solution.py`.
