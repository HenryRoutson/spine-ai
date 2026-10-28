import json
from typing import Any, Callable

# AI : type aliases differentiate the two record shapes even though both are dicts
LegacyRecord = dict[str, Any]
NewRecord = dict[str, Any]
FieldSpec = dict[str, str]
TransformFn = Callable[[Any], Any]

TRANSFORMS: dict[str, TransformFn] = {
    # TODO: register lowercase, first_word, last_word, yn_to_bool, ddmmyyyy_to_iso
}


def set_nested(record: NewRecord, dotted_key: str, value: Any) -> None:
    # TODO: "address.city" should create/walk nested dicts, then set the leaf
    raise NotImplementedError


def migrate_record(legacy: LegacyRecord, fields: dict[str, FieldSpec]) -> NewRecord:
    # TODO: for each target field, resolve source -> transform -> default per the rules
    raise NotImplementedError


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
