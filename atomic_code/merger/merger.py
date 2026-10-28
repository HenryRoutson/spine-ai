"""
Recursive structural merger with per-path layer policies.

Path rules use dot segments; ``*`` matches any single segment (dict key, list index,
or keyed list-item identity). Examples: ``tags``, ``users.*.roles``, ``**`` (all nodes).

Keyed list strategies (union / intersect / concat_dedupe) recursively merge matching
elements so nested policies still apply. ``zip`` merges by index. Unhashable items need
``key=`` / ``item_key=`` (dotted paths ok, e.g. ``meta.id``).
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
    UNION_ASSERT = "union_assert"
    INTERSECT = "intersect"
    INTERSECT_ASSERT = "intersect_assert"
    REPLACE = "replace"
    REPLACE_ASSERT = "replace_assert"
    PREPEND = "prepend"
    PREPEND_ASSERT = "prepend_assert"
    # AI : pairwise deep-merge by index; leftover items from the longer list are kept
    ZIP = "zip"


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
        return _merge_lists(left, right, policy, path, layer)
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


def _merge_lists(
    left: list[Any],
    right: list[Any],
    policy: MergePolicy,
    path: Path,
    layer: LayerPolicy,
) -> list[Any]:
    strategy = layer.list

    if strategy is ListStrategy.REPLACE:
        return list(right)

    if strategy is ListStrategy.PREPEND:
        return list(right) + list(left)

    if strategy is ListStrategy.CONCAT:
        return list(left) + list(right)

    if strategy is ListStrategy.ZIP:
        return _zip_merge_lists(left, right, policy, path)

    if strategy is ListStrategy.CONCAT_DEDUPE:
        return _dedupe_merge_order(list(left) + list(right), layer.key, policy, path)

    if strategy is ListStrategy.CONCAT_ASSERT_NO_DUPLICATES:
        return _assert_no_duplicates(list(left) + list(right), layer.key, path)

    if strategy is ListStrategy.UNION:
        return _set_op_lists(left, right, layer.key, policy, path, op="union")

    if strategy is ListStrategy.UNION_ASSERT:
        return _assert_union_no_overlap(left, right, layer.key, path)

    if strategy is ListStrategy.INTERSECT:
        return _set_op_lists(left, right, layer.key, policy, path, op="intersect")

    if strategy is ListStrategy.INTERSECT_ASSERT:
        return _assert_intersect_subset(left, right, layer.key, path)

    if strategy is ListStrategy.REPLACE_ASSERT:
        return _assert_replace_empty_left(left, right, path)

    if strategy is ListStrategy.PREPEND_ASSERT:
        return _assert_prepend_empty_right(left, right, path)

    raise ValueError(f"unknown list strategy: {strategy}")


def _path_for_list_item(path: Path, ck: ComparisonKey, index: int) -> Path:
    # AI : prefer stable identity in the path so rules like users.*.roles / users.alice.roles work
    if isinstance(ck, (str, int)) and not isinstance(ck, bool):
        return (*path, ck)
    return (*path, index)


def _zip_merge_lists(
    left: list[Any],
    right: list[Any],
    policy: MergePolicy,
    path: Path,
) -> list[Any]:
    n = max(len(left), len(right))
    out: list[Any] = []
    for i in range(n):
        child = (*path, i)
        if i < len(left) and i < len(right):
            out.append(_merge_pair(left[i], right[i], policy, child))
        elif i < len(left):
            out.append(left[i])
        else:
            out.append(right[i])
    return out


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
    policy: MergePolicy,
    path: Path,
    *,
    op: str,
) -> list[Any]:
    # AI : union/intersect on keys; matching items are recursively merged (not first-wins)
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
    key_index: dict[ComparisonKey, int] = {}
    for i, (item, ck) in enumerate(zip(left, left_keys, strict=True)):
        if ck not in key_to_item:
            key_to_item[ck] = item
            key_index[ck] = i
        else:
            child = _path_for_list_item(path, ck, key_index[ck])
            key_to_item[ck] = _merge_pair(key_to_item[ck], item, policy, child)
    for i, (item, ck) in enumerate(zip(right, right_keys, strict=True)):
        if ck not in key_to_item:
            key_to_item[ck] = item
            key_index[ck] = len(left) + i
        else:
            child = _path_for_list_item(path, ck, key_index[ck])
            key_to_item[ck] = _merge_pair(key_to_item[ck], item, policy, child)

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


def _dedupe_merge_order(
    items: list[Any],
    key_fn: KeyFn | None,
    policy: MergePolicy,
    path: Path,
) -> list[Any]:
    # AI : same key → recursive merge into the first occurrence (policies apply inside)
    seen: dict[ComparisonKey, int] = {}
    out: list[Any] = []
    for item in items:
        ck = _comparison_key(item, key_fn)
        if ck in seen:
            idx = seen[ck]
            child = _path_for_list_item(path, ck, idx)
            out[idx] = _merge_pair(out[idx], item, policy, child)
            continue
        seen[ck] = len(out)
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


def _assert_union_no_overlap(
    left: list[Any],
    right: list[Any],
    key_fn: KeyFn | None,
    path: Path,
) -> list[Any]:
    left_keys = [_comparison_key(item, key_fn) for item in left]
    left_set = set(left_keys)
    for item in right:
        ck = _comparison_key(item, key_fn)
        if ck in left_set:
            raise TypeError(
                f"union key overlap at path {_path_label(path)} (key={ck!r})"
            )
    return list(left) + list(right)


def _assert_intersect_subset(
    left: list[Any],
    right: list[Any],
    key_fn: KeyFn | None,
    path: Path,
) -> list[Any]:
    right_set = {_comparison_key(item, key_fn) for item in right}
    for item in left:
        ck = _comparison_key(item, key_fn)
        if ck not in right_set:
            raise TypeError(
                f"intersect: left item not in right at path {_path_label(path)} (key={ck!r})"
            )
    return list(left)


def _assert_replace_empty_left(left: list[Any], right: list[Any], path: Path) -> list[Any]:
    if left:
        raise TypeError(
            f"replace assert: left list must be empty at path {_path_label(path)} "
            f"(got {len(left)} items)"
        )
    return list(right)


def _assert_prepend_empty_right(left: list[Any], right: list[Any], path: Path) -> list[Any]:
    if right:
        raise TypeError(
            f"prepend assert: right list must be empty at path {_path_label(path)} "
            f"(got {len(right)} items)"
        )
    return list(left)


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
    # AI : ``*`` = one segment; ``**`` = any span (leading, mid, or trailing)
    pattern_parts = tuple(p for p in pattern.split(".") if p)
    if not pattern_parts:
        return 0 if not path else None
    if "**" in pattern_parts:
        return _globstar_match_depth(pattern_parts, path)
    if len(pattern_parts) > len(path):
        return None
    offset = len(path) - len(pattern_parts)
    if _suffix_match(pattern_parts, path[offset:]):
        return len(pattern_parts)
    return None


def _globstar_match_depth(pattern: Sequence[str], path: Path) -> int | None:
    # AI : find longest match of pattern against path with ** spanning zero+ segments
    best = _globstar_match_from(pattern, path, 0, 0)
    return best


def _globstar_match_from(
    pattern: Sequence[str],
    path: Path,
    pi: int,
    si: int,
) -> int | None:
    if pi == len(pattern):
        return len(path) if si == len(path) else None
    if pattern[pi] == "**":
        best: int | None = None
        for span in range(si, len(path) + 1):
            depth = _globstar_match_from(pattern, path, pi + 1, span)
            if depth is not None and (best is None or depth > best):
                best = depth
        return best
    if si >= len(path):
        return None
    if pattern[pi] != "*" and str(pattern[pi]) != str(path[si]):
        return None
    return _globstar_match_from(pattern, path, pi + 1, si + 1)


def _suffix_match(pattern: Sequence[str], path: Path) -> bool:
    if len(pattern) != len(path):
        return False
    for pat, seg in zip(pattern, path, strict=True):
        if pat == "*":
            continue
        if str(pat) != str(seg):
            return False
    return True


def _item_key_fn(key_path: str) -> KeyFn:
    parts = tuple(p for p in key_path.split(".") if p)

    def fn(item: Any) -> ComparisonKey:
        cur: Any = item
        for part in parts:
            if not isinstance(cur, Mapping) or part not in cur:
                raise TypeError(f"item_key {key_path!r} missing on {item!r}")
            cur = cur[part]
        if cur is None:
            raise TypeError(f"item_key {key_path!r} is null on {item!r}")
        try:
            hash(cur)
        except TypeError as exc:
            raise TypeError(f"item_key {key_path!r} is unhashable: {cur!r}") from exc
        return cur

    return fn


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
        elif name in ("key", "item_key"):
            policy_kwargs["key"] = _item_key_fn(value) if isinstance(value, str) else value
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
    # --- list layer: CONCAT keeps every record; UNION collapses by key + deep-merges matches ---
    list_concat = MergePolicy(rules=[rule("users", list=ListStrategy.CONCAT)])
    assert merge(list_left, list_right, list_concat) == {
        "users": [
            {"id": 1, "roles": ["admin"]},
            {"id": 2, "roles": ["viewer"]},
            {"id": 1, "roles": ["billing"]},
            {"id": 3, "roles": ["admin"]},
        ]
    }

    list_by_id = MergePolicy(
        rules=[
            rule("users", list=ListStrategy.UNION, item_key="id"),
            rule("users.*.roles", list=ListStrategy.CONCAT_DEDUPE),
        ]
    )
    assert merge(list_left, list_right, list_by_id) == {
        "users": [
            {"id": 1, "roles": ["admin", "billing"]},
            {"id": 2, "roles": ["viewer"]},
            {"id": 3, "roles": ["admin"]},
        ]
    }

    # --- union on hashable list (set conversion is explicit via UNION strategy) ---
    union_nums = MergePolicy(rules=[rule("ids", list=ListStrategy.UNION)])
    assert merge({"ids": [1, 2, 3]}, {"ids": [3, 4]}, union_nums) == {"ids": [1, 2, 3, 4]}

    # --- union on dict items needs a key; matching records deep-merge ---
    union_users = MergePolicy(
        rules=[
            rule("users", list=ListStrategy.UNION, item_key="id"),
            rule("users.*.roles", list=ListStrategy.CONCAT),
        ]
    )
    merged_users = merge(
        {"users": [{"id": 1, "roles": ["a"]}, {"id": 2, "roles": []}]},
        {"users": [{"id": 1, "roles": ["b"]}, {"id": 3, "roles": []}]},
        union_users,
    )
    assert merged_users == {
        "users": [
            {"id": 1, "roles": ["a", "b"]},
            {"id": 2, "roles": []},
            {"id": 3, "roles": []},
        ]
    }

    # --- zip merges by index into nested structures ---
    zip_policy = MergePolicy(rules=[rule("rows", list=ListStrategy.ZIP)])
    assert merge(
        {"rows": [{"n": 1}, {"n": 2}]},
        {"rows": [{"extra": True}, {"n": 9}]},
        zip_policy,
    ) == {"rows": [{"n": 1, "extra": True}, {"n": 9}]}

    # --- dict[str, list[dict[str, dict[str, str]]]] with per-layer strategies ---
    deep_left = {
        "grp": [
            {"id": "r1", "meta": {"k": "old", "keep": "L"}},
            {"id": "r2", "meta": {"k": "solo"}},
        ]
    }
    deep_right = {
        "grp": [
            {"id": "r1", "meta": {"k": "new", "extra": "R"}},
        ]
    }
    deep_policy = MergePolicy(
        rules=[
            rule("*", list=ListStrategy.UNION, item_key="id"),
            rule("*.*.meta", dict=DictStrategy.DEEP),
            rule("*.*.meta.k", scalar=ScalarStrategy.FIRST),
        ]
    )
    assert merge(deep_left, deep_right, deep_policy) == {
        "grp": [
            {"id": "r1", "meta": {"k": "old", "keep": "L", "extra": "R"}},
            {"id": "r2", "meta": {"k": "solo"}},
        ]
    }

    # --- mid-path ** glob ---
    mid_glob = MergePolicy(rules=[rule("teams.**.roles", list=ListStrategy.CONCAT_DEDUPE)])
    assert merge(
        {"teams": {"ops": {"roles": ["x", "y"]}}},
        {"teams": {"ops": {"roles": ["y", "z"]}}},
        mid_glob,
    ) == {"teams": {"ops": {"roles": ["x", "y", "z"]}}}

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
