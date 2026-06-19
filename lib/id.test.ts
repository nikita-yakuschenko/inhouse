import { describe, expect, it } from "vitest";
import {
  ENTITY_ID_REGEX,
  generateEntityId,
  generateEntityIds,
  isEntityId,
} from "@/lib/id";

describe("entity id", () => {
  it("generates 8-char uppercase alphanumeric ids", () => {
    const id = generateEntityId();
    expect(id).toHaveLength(8);
    expect(ENTITY_ID_REGEX.test(id)).toBe(true);
    expect(isEntityId(id)).toBe(true);
  });

  it("generates unique batch ids", () => {
    const ids = generateEntityIds(50);
    expect(new Set(ids).size).toBe(50);
    ids.forEach((id) => expect(isEntityId(id)).toBe(true));
  });

  it("rejects invalid ids", () => {
    expect(isEntityId("abc12345")).toBe(false);
    expect(isEntityId("1234567")).toBe(false);
    expect(isEntityId("123456789")).toBe(false);
    expect(isEntityId("ІВ123456")).toBe(false);
  });
});
