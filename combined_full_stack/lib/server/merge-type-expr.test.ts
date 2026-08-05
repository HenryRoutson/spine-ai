import { describe, expect, it } from "vitest";
import { DEFAULT_MERGE_POLICY } from "@/lib/merger";
import { deriveMergePairType, deriveMergeSpineOutType } from "@/lib/merge-type-expr";
import {
  MergeDictStrategy,
  MergeListStrategy,
  MergeScalarStrategy,
  type MergePolicy,
  type StructureModel,
  type StructureModelId,
} from "@/lib/types";

const usersA: StructureModel = {
  id: "sm_users_a" as StructureModelId,
  name: "UsersA",
  description: "",
  fields: [
    { name: "id", type: "int" },
    { name: "roles", type: "list[text]" },
  ],
};

const usersB: StructureModel = {
  id: "sm_users_b" as StructureModelId,
  name: "UsersB",
  description: "",
  fields: [
    { name: "id", type: "int" },
    { name: "billing", type: "text" },
  ],
};

const row: StructureModel = {
  id: "sm_row" as StructureModelId,
  name: "Row",
  description: "",
  fields: [
    { name: "tags", type: "list[text]" },
    { name: "users", type: "list[model]", ref: usersA.id },
  ],
};

describe("deriveMergeSpineOutType", () => {
  it("deep-merge dict fields from folded list items", () => {
    const inType = {
      kind: "list" as const,
      item: { kind: "ref" as const, modelId: row.id },
    };
    const { outType, models } = deriveMergeSpineOutType(inType, DEFAULT_MERGE_POLICY, [row, usersA]);

    expect(outType).toEqual({
      kind: "list",
      item: { kind: "ref", modelId: row.id },
    });
    expect(models.filter((m) => m.auto)).toHaveLength(0);
  });

  it("union list records merges item model fields", () => {
    const policy: MergePolicy = {
      default: {
        list: MergeListStrategy.Union,
        dict: MergeDictStrategy.Deep,
        scalar: MergeScalarStrategy.Last,
        itemKey: "id",
      },
    };
    const left = { kind: "ref" as const, modelId: usersA.id };
    const right = { kind: "ref" as const, modelId: usersB.id };
    const { outType, models } = deriveMergePairType(left, right, policy, [usersA, usersB], "mod_merge");

    expect(outType).toEqual({ kind: "ref", modelId: "sm_merge_mod_merge" });
    const merged = models.find((m) => m.id === "sm_merge_mod_merge");
    expect(merged?.fields.map((f) => f.name).sort()).toEqual(["billing", "id", "roles"]);
  });

  it("intersect list keeps left item type", () => {
    const policy: MergePolicy = {
      default: { list: MergeListStrategy.Intersect, dict: MergeDictStrategy.Deep },
    };
    const inType = {
      kind: "list" as const,
      item: { kind: "ref" as const, modelId: usersA.id },
    };
    const { outType } = deriveMergeSpineOutType(inType, policy, [usersA]);

    expect(outType).toEqual({
      kind: "list",
      item: { kind: "ref", modelId: usersA.id },
    });
  });

  it("passthrough single object type unchanged", () => {
    const inType = { kind: "ref" as const, modelId: row.id };
    const { outType } = deriveMergeSpineOutType(inType, DEFAULT_MERGE_POLICY, [row]);
    expect(outType).toEqual(inType);
  });
});
