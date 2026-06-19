# Run run_v9mkzgs

- **Status:** error
- **Model:** deepseek-v3
- **Total:** 7ms · billed 0.00c · saved 0.00c

## Steps

### Legacy Users (input) — ok
- 1ms · 0.00c
- in: json document
- out: loaded json → sha_538265aa171d99d5
### Parse JSON Records (custom-code) — ok
- 2ms · 0.00c
- in: SourceDocument
- out: custom ts fn applied ((d) => JSON.parse(d.body))

```json
[
  {
    "ID": 101,
    "FullName": "Ada Lovelace",
    "EMAIL_ADDR": "Ada@Example.COM",
    "signup": "15/03/2021",
    "addr_street": "12 Byron St",
    "addr_city": "London",
    "is_active": "Y",
    "fax": "none"
  },
  {
    "ID": 102,
    "FullName": "Grace Brewster Hopper",
    "EMAIL_ADDR": "GRACE@Navy.MIL",
    "signup": "01/12/2019",
    "addr_street": "3 Cobol Ave",
    "addr_city": "Arlington",
    "is_active": "N",
    "fax": "555-0100"
  },
  {
    "ID": 103,
    "FullName": "Alan Turing",
    "EMAIL_ADDR": "alan@bletchley.org",
    "signup": "23/06/2020",
    "addr_street": "1 Enigma Rd",
    "is_active": "Y"
  }
]
```

### Field Mapping (input) — ok
- 0ms · 0.00c
- in: Any
- out: loaded json → sha_0dcc833796d5b928
### Combine Inputs (combine) — ok
- 1ms · 0.00c
- in: LegacyUser
- out: merged → {"mapping", "legacy_users"}

```json
{
  "mapping": "sha_0dcc833796d5b928",
  "legacy_users": "3 items"
}
```

### Apply Field Mapping (custom-code) — error
- 3ms · 0.00c
- in: MigrationInput
- out: output failed MigratedUser validation: [
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "address",
      "city"
    ],
    "message": "Invalid input: expected string, received null"
  }
]