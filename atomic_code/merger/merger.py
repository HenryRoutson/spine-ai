"""
Recursive structural merger with per-path layer policies.

Path rules use dot segments; ``*`` matches any single segment (dict key or list index).
Examples: ``tags``, ``users.*.roles``, ``**`` (all nodes).

List strategies that dedupe or union convert elements to comparison keys:
  - hashable items are used directly (lists become tuples only for set membership checks)
  - unhashable items (dicts, nested lists) require ``key=`` on the rule or default policy
"""

from __future__ import annotations

from collections.abc import Callable, Hashable, Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

PathSegment = str | int
Path = tuple[PathSegment, ...]


class ListStrategy(str, Enum):
    CONCAT = "concat"
    CONCAT_DEDUPE = "concat_dedupe"
    CONCAT_ASSERT_NO_DUPLICATES = "concat_assert_no_duplicates"
    UNION = "union"
    INTERSECT = "intersect"
    REPLACE = "replace"
    PREPEND = "prepend"


class DictStrategy(str, Enum):
    DEEP = "deep"
    SHALLOW = "shallow"
    REPLACE = "replace"


class ScalarStrategy(str, Enum):
    LAST = "last"
    FIRST = "first"
    ERROR = "error"


type ComparisonKey = Hashable
type KeyFn = Callable[[Any], ComparisonKey]


@dataclass(frozen=True)
class LayerPolicy:
    list: ListStrategy = ListStrategy.CONCAT
    dict: DictStrategy = DictStrategy.DEEP
    scalar: ScalarStrategy = ScalarStrategy.LAST
    key: KeyFn | None = None


@dataclass
class MergePolicy:
    default: LayerPolicy = field(default_factory=LayerPolicy)
    rules: list[tuple[str, LayerPolicy]] = field(default_factory=list)

    def resolve(self, path: Path) -> LayerPolicy:
        matched: LayerPolicy | None = None
        matched_depth = -1
        for pattern, policy in self.rules:
            depth = _pattern_match_depth(pattern, path)
            if depth is not None and depth > matched_depth:
                matched = policy
                matched_depth = depth
        return matched if matched is not None else self.default


def merge(left: Any, right: Any, policy: MergePolicy | None = None) -> Any:
    return merge_all(left, right, policy=policy)


def merge_all(*values: Any, policy: MergePolicy | None = None) -> Any:
    active_policy = policy or MergePolicy()
    present = [v for v in values if v is not None]
    if not present:
        return None
    if len(present) == 1:
        return present[0]
    result = present[0]
    for nxt in present[1:]:
        result = _merge_pair(result, nxt, active_policy, ())
    return result


def _merge_pair(left: Any, right: Any, policy: MergePolicy, path: Path) -> Any:
    if left is None:
        return right
    if right is None:
        return left

    layer = policy.resolve(path)

    if isinstance(left, Mapping) and isinstance(right, Mapping):
        return _merge_dicts(left, right, policy, path, layer)
    if isinstance(left, list) and isinstance(right, list):
        return _merge_lists(left, right, layer, path)
    if _is_scalar(left) and _is_scalar(right):
        return _merge_scalars(left, right, layer)
    if type(left) is type(right):
        return right if layer.scalar is ScalarStrategy.LAST else left

    raise TypeError(
        f"cannot merge {type(left).__name__} with {type(right).__name__} at path {_path_label(path)}"
    )


def _merge_dicts(
    left: Mapping[Any, Any],
    right: Mapping[Any, Any],
    policy: MergePolicy,
    path: Path,
    layer: LayerPolicy,
) -> dict[Any, Any]:
    if layer.dict is DictStrategy.REPLACE:
        return dict(right)

    if layer.dict is DictStrategy.SHALLOW:
        merged = dict(left)
        merged.update(right)
        return merged

    keys = set(left.keys()) | set(right.keys())
    out: dict[Any, Any] = {}
    for key in keys:
        child_path: Path = (*path, key)
        if key in left and key in right:
            out[key] = _merge_pair(left[key], right[key], policy, child_path)
        elif key in left:
            out[key] = left[key]
        else:
            out[key] = right[key]
    return out


def _merge_lists(left: list[Any], right: list[Any], layer: LayerPolicy, path: Path) -> list[Any]:
    strategy = layer.list

    if strategy is ListStrategy.REPLACE:
        return list(right)

    if strategy is ListStrategy.PREPEND:
        combined = list(right) + list(left)
        return combined

    if strategy is ListStrategy.CONCAT:
        return list(left) + list(right)

    if strategy is ListStrategy.CONCAT_DEDUPE:
        return _dedupe_preserve_order(list(left) + list(right), layer.key)

    if strategy is ListStrategy.CONCAT_ASSERT_NO_DUPLICATES:
        return _assert_no_duplicates(list(left) + list(right), layer.key, path)

    if strategy is ListStrategy.UNION:
        return _set_op_lists(left, right, layer.key, op="union")

    if strategy is ListStrategy.INTERSECT:
        return _set_op_lists(left, right, layer.key, op="intersect")

    raise ValueError(f"unknown list strategy: {strategy}")


def _merge_scalars(left: Any, right: Any, layer: LayerPolicy) -> Any:
    if layer.scalar is ScalarStrategy.FIRST:
        return left
    if layer.scalar is ScalarStrategy.LAST:
        return right
    raise TypeError("scalar conflict under ScalarStrategy.ERROR")


def _set_op_lists(
    left: list[Any],
    right: list[Any],
    key_fn: KeyFn | None,
    *,
    op: str,
) -> list[Any]:
    # AI : union/intersect use set logic on comparison keys; output order follows first operand then new items from second
    left_keys: list[ComparisonKey] = [_comparison_key(item, key_fn) for item in left]
    right_keys: list[ComparisonKey] = [_comparison_key(item, key_fn) for item in right]

    left_set = set(left_keys)
    right_set = set(right_keys)

    if op == "union":
        wanted = left_set | right_set
        ordered_keys = _union_key_order(left_keys, right_keys, wanted)
    elif op == "intersect":
        wanted = left_set & right_set
        ordered_keys = [k for k in left_keys if k in wanted]
        seen: set[ComparisonKey] = set()
        ordered_keys = [k for k in ordered_keys if not (k in seen or seen.add(k))]
    else:
        raise ValueError(op)

    key_to_item: dict[ComparisonKey, Any] = {}
    for item, ck in zip(left, left_keys, strict=True):
        key_to_item.setdefault(ck, item)
    for item, ck in zip(right, right_keys, strict=True):
        key_to_item.setdefault(ck, item)

    return [key_to_item[ck] for ck in ordered_keys]


def _union_key_order(
    left_keys: list[ComparisonKey],
    right_keys: list[ComparisonKey],
    wanted: set[ComparisonKey],
) -> list[ComparisonKey]:
    out: list[ComparisonKey] = []
    seen: set[ComparisonKey] = set()
    for ck in left_keys + right_keys:
        if ck in wanted and ck not in seen:
            seen.add(ck)
            out.append(ck)
    return out


def _dedupe_preserve_order(items: list[Any], key_fn: KeyFn | None) -> list[Any]:
    seen: set[ComparisonKey] = set()
    out: list[Any] = []
    for item in items:
        ck = _comparison_key(item, key_fn)
        if ck in seen:
            continue
        seen.add(ck)
        out.append(item)
    return out


def _assert_no_duplicates(items: list[Any], key_fn: KeyFn | None, path: Path) -> list[Any]:
    seen: set[ComparisonKey] = set()
    out: list[Any] = []
    for item in items:
        ck = _comparison_key(item, key_fn)
        if ck in seen:
            raise TypeError(
                f"duplicate list item at path {_path_label(path)} (key={ck!r})"
            )
        seen.add(ck)
        out.append(item)
    return out


def _comparison_key(item: Any, key_fn: KeyFn | None) -> ComparisonKey:
    if key_fn is not None:
        return key_fn(item)
    try:
        hash(item)
        return item
    except TypeError:
        if isinstance(item, list):
            return ("__list__", tuple(_comparison_key(x, None) for x in item))
        if isinstance(item, Mapping):
            return (
                "__dict__",
                tuple(sorted((k, _comparison_key(v, None)) for k, v in item.items())),
            )
        raise TypeError(
            f"unhashable item {item!r}; provide LayerPolicy.key or use CONCAT instead"
        ) from None


def _is_scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _pattern_match_depth(pattern: str, path: Path) -> int | None:
    pattern_parts = tuple(p for p in pattern.split(".") if p)
    if not pattern_parts:
        return 0 if not path else None

    if pattern_parts[0] == "**":
        suffix = pattern_parts[1:]
        if not suffix:
            return len(path)
        best: int | None = None
        for start in range(len(path) + 1):
            if _suffix_match(suffix, path[start:]):
                depth = start + len(suffix)
                if best is None or depth > best:
                    best = depth
        return best

    if len(pattern_parts) > len(path):
        return None
    offset = len(path) - len(pattern_parts)
    if _suffix_match(pattern_parts, path[offset:]):
        return len(pattern_parts)
    return None


def _suffix_match(pattern: Sequence[str], path: Path) -> bool:
    if len(pattern) != len(path):
        return False
    for pat, seg in zip(pattern, path, strict=True):
        if pat == "*":
            continue
        if str(pat) != str(seg):
            return False
    return True


def _path_label(path: Path) -> str:
    if not path:
        return "<root>"
    return ".".join(str(seg) for seg in path)


def rule(path_pattern: str, **kwargs: Any) -> tuple[str, LayerPolicy]:
    policy_kwargs: dict[str, Any] = {}
    for name, value in kwargs.items():
        if name == "list" and isinstance(value, str):
            policy_kwargs[name] = ListStrategy(value)
        elif name == "dict" and isinstance(value, str):
            policy_kwargs[name] = DictStrategy(value)
        elif name == "scalar" and isinstance(value, str):
            policy_kwargs[name] = ScalarStrategy(value)
        else:
            policy_kwargs[name] = value
    return path_pattern, LayerPolicy(**policy_kwargs)


def _run_examples() -> None:
    # --- simple dict deep merge, lists concat by default ---
    a = {"x": 1, "tags": ["a", "b"]}
    b = {"y": 2, "tags": ["b", "c"]}
    assert merge(a, b) == {"x": 1, "y": 2, "tags": ["a", "b", "b", "c"]}

    # --- dedupe tags only at that layer ---
    dedupe_tags = MergePolicy(rules=[rule("tags", list=ListStrategy.CONCAT_DEDUPE)])
    assert merge(a, b, dedupe_tags) == {"x": 1, "y": 2, "tags": ["a", "b", "c"]}

    # --- nested: dict of user records; roles deduped when the same user key merges ---
    left = {
        "users": {
            "alice": {"roles": ["admin", "editor"]},
            "bob": {"roles": ["viewer"]},
        }
    }
    right = {
        "users": {
            "alice": {"roles": ["editor", "billing"]},
            "carol": {"roles": ["admin"]},
        }
    }
    nested = MergePolicy(
        rules=[
            rule("users.*.roles", list=ListStrategy.CONCAT_DEDUPE),
        ]
    )
    assert merge(left, right, nested) == {
        "users": {
            "alice": {"roles": ["admin", "editor", "billing"]},
            "bob": {"roles": ["viewer"]},
            "carol": {"roles": ["admin"]},
        }
    }

    # --- list layer concat keeps separate records; use UNION + key to collapse by id ---
    list_left = {
        "users": [
            {"id": 1, "roles": ["admin"]},
            {"id": 2, "roles": ["viewer"]},
        ]
    }
    list_right = {
        "users": [
            {"id": 1, "roles": ["billing"]},
            {"id": 3, "roles": ["admin"]},
        ]
    }
    # --- list layer: CONCAT keeps every record; UNION collapses by key (first record wins) ---
    list_concat = MergePolicy(rules=[rule("users", list=ListStrategy.CONCAT)])
    assert merge(list_left, list_right, list_concat) == {
        "users": [
            {"id": 1, "roles": ["admin"]},
            {"id": 2, "roles": ["viewer"]},
            {"id": 1, "roles": ["billing"]},
            {"id": 3, "roles": ["admin"]},
        ]
    }

    list_by_id = MergePolicy(rules=[rule("users", list=ListStrategy.UNION, key=lambda u: u["id"])])
    assert merge(list_left, list_right, list_by_id) == {
        "users": [
            {"id": 1, "roles": ["admin"]},
            {"id": 2, "roles": ["viewer"]},
            {"id": 3, "roles": ["admin"]},
        ]
    }

    # --- union on hashable list (set conversion is explicit via UNION strategy) ---
    union_nums = MergePolicy(rules=[rule("ids", list=ListStrategy.UNION)])
    assert merge({"ids": [1, 2, 3]}, {"ids": [3, 4]}, union_nums) == {"ids": [1, 2, 3, 4]}

    # --- union on dict items needs a key ---
    def user_key(u: dict[str, Any]) -> int:
        return u["id"]

    union_users = MergePolicy(
        rules=[
            rule(
                "users",
                list=ListStrategy.UNION,
                key=user_key,
            )
        ]
    )
    merged_users = merge(
        {"users": [{"id": 1, "roles": ["a"]}, {"id": 2, "roles": []}]},
        {"users": [{"id": 1, "roles": ["b"]}, {"id": 3, "roles": []}]},
        union_users,
    )
    assert merged_users == {
        "users": [
            {"id": 1, "roles": ["a"]},
            {"id": 2, "roles": []},
            {"id": 3, "roles": []},
        ]
    }

    # --- intersect keeps only shared keys (by comparison key) ---
    intersect = MergePolicy(rules=[rule("items", list=ListStrategy.INTERSECT)])
    assert merge({"items": ["a", "b", "c"]}, {"items": ["b", "c", "d"]}, intersect) == {
        "items": ["b", "c"]
    }

    # --- dict replace at a layer ---
    replace_meta = MergePolicy(rules=[rule("meta", dict=DictStrategy.REPLACE)])
    assert merge(
        {"meta": {"a": 1, "b": 2}, "data": [1]},
        {"meta": {"c": 3}, "data": [2]},
        replace_meta,
    ) == {"meta": {"c": 3}, "data": [1, 2]}

    # --- scalar strategies ---
    first = MergePolicy(default=LayerPolicy(scalar=ScalarStrategy.FIRST))
    assert merge({"n": 10}, {"n": 99}, first) == {"n": 10}

    # --- merge_all with three sources ---
    assert merge_all({"k": [1]}, {"k": [2]}, {"k": [3]}) == {"k": [1, 2, 3]}

    # --- prepend lists ---
    prepend = MergePolicy(rules=[rule("log", list=ListStrategy.PREPEND)])
    assert merge({"log": ["old"]}, {"log": ["new"]}, prepend) == {"log": ["new", "old"]}

    # --- wildcard path: dedupe roles when the same dict key is merged at any depth ---
    any_roles = MergePolicy(rules=[rule("**.roles", list=ListStrategy.CONCAT_DEDUPE)])
    assert merge(
        {"teams": {"ops": {"roles": ["x", "y"]}}},
        {"teams": {"ops": {"roles": ["y", "z"]}}},
        any_roles,
    ) == {"teams": {"ops": {"roles": ["x", "y", "z"]}}}

    # --- automatic structural key for nested unhashable dedupe ---
    struct_dedupe = MergePolicy(rules=[rule("rows", list=ListStrategy.CONCAT_DEDUPE)])
    assert merge(
        {"rows": [{"a": 1}, {"b": 2}, {"a": 1}]},
        {"rows": [{"b": 2}]},
        struct_dedupe,
    ) == {"rows": [{"a": 1}, {"b": 2}]}

    print("all merger examples passed")


if __name__ == "__main__":
    _run_examples()
