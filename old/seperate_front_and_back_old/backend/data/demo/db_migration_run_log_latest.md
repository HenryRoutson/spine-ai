# Run run_01yliku

- **Status:** ok
- **Model:** deepseek-v3
- **Total:** 8ms · billed 0.00c · saved 0.00c

## Steps

### Legacy Users (input) — ok
- 0ms · 0.00c
- in: json document
- out: loaded json → sha_538265aa171d99d5
### Parse JSON Records (custom-code) — ok
- 3ms · 0.00c
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
- 1ms · 0.00c
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

### Apply Field Mapping (custom-code) — ok
- 2ms · 0.00c
- in: MigrationInput
- out: custom ts fn applied ((input) => {)

```json
[
  {
    "user_id": 101,
    "first_name": "Ada",
    "last_name": "Lovelace",
    "email": "ada@example.com",
    "signed_up_at": "2021-03-15",
    "address": {
      "street": "12 Byron St",
      "city": "London"
    },
    "active": true,
    "plan": "free"
  },
  {
    "user_id": 102,
    "first_name": "Grace",
    "last_name": "Hopper",
    "email": "grace@navy.mil",
    "signed_up_at": "2019-12-01",
    "address": {
      "street": "3 Cobol Ave",
      "city": "Arlington"
    },
    "active": false,
    "plan": "free"
  },
  {
    "user_id": 103,
    "first_name": "Alan",
    "last_name": "Turing",
    "email": "alan@bletchley.org",
    "signed_up_at": "2020-06-23",
    "address": {
      "street": "1 Enigma Rd",
      "city": null
    },
    "active": true,
    "plan": "free"
  }
]
```

### Migrated Users (output) — ok
- 1ms · 0.00c
- in: MigratedUser
- out: MigratedUser.md emitted

```json
[
  {
    "user_id": 101,
    "first_name": "Ada",
    "last_name": "Lovelace",
    "email": "ada@example.com",
    "signed_up_at": "2021-03-15",
    "address": {
      "street": "12 Byron St",
      "city": "London"
    },
    "active": true,
    "plan": "free"
  },
  {
    "user_id": 102,
    "first_name": "Grace",
    "last_name": "Hopper",
    "email": "grace@navy.mil",
    "signed_up_at": "2019-12-01",
    "address": {
      "street": "3 Cobol Ave",
      "city": "Arlington"
    },
    "active": false,
    "plan": "free"
  },
  {
    "user_id": 103,
    "first_name": "Alan",
    "last_name": "Turing",
    "email": "alan@bletchley.org",
    "signed_up_at": "2020-06-23",
    "address": {
      "street": "1 Enigma Rd",
      "city": null
    },
    "active": true,
    "plan": "free"
  }
]
```
