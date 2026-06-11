import json
from typing import Any, Callable

# AI : type aliases differentiate the two record shapes even though both are dicts
LegacyRecord = dict[str, Any]
NewRecord = dict[str, Any]
FieldSpec = dict[str, str]
TransformFn = Callable[[Any], Any]

# AI : transforms live in a dict so the mapping JSON stays pure data —
# AI : adding a transform never touches the migration logic
TRANSFORMS: dict[str, TransformFn] = {
    "lowercase": lambda v: v.lower(),
    "first_word": lambda v: v.split()[0],
    "last_word": lambda v: v.split()[-1],
    "yn_to_bool": lambda v: v == "Y",
    "ddmmyyyy_to_iso": lambda v: "-".join(reversed(v.split("/"))),
}


def set_nested(record: NewRecord, dotted_key: str, value: Any) -> None:
    # AI : walk/create parents, then assign at the leaf
    *parents, leaf = dotted_key.split(".")
    for key in parents:
        record = record.setdefault(key, {})
    record[leaf] = value


def migrate_record(legacy: LegacyRecord, fields: dict[str, FieldSpec]) -> NewRecord:
    new: NewRecord = {}
    for target, spec in fields.items():
        value = legacy.get(spec["source"]) if "source" in spec else None
        if value is None:
            value = spec.get("default")  # AI : defaults bypass transforms by rule 3
        elif "transform" in spec:
            value = TRANSFORMS[spec["transform"]](value)
        set_nested(new, target, value)
    return new


def main() -> None:
    with open("data/database_field_mapping.json") as f:
        fields: dict[str, FieldSpec] = json.load(f)["fields"]
    with open("data/database_legacy_users.json") as f:
        legacy: list[LegacyRecord] = json.load(f)

    migrated: list[NewRecord] = [migrate_record(r, fields) for r in legacy]
    with open("database_output.json", "w") as f:
        json.dump(migrated, f, indent=2)


if __name__ == "__main__":
    main()
