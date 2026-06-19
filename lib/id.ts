import { randomBytes } from "node:crypto";
import { z } from "zod";

export const ENTITY_ID_LENGTH = 8;
export const ENTITY_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ENTITY_ID_REGEX = /^[0-9A-Z]{8}$/;

export const entityIdSchema = z
  .string()
  .length(ENTITY_ID_LENGTH, `Идентификатор должен содержать ${ENTITY_ID_LENGTH} символов`)
  .regex(ENTITY_ID_REGEX, "Идентификатор: только цифры 0-9 и латиница A-Z");

export function isEntityId(value: string): boolean {
  return ENTITY_ID_REGEX.test(value);
}

export function generateEntityId(): string {
  const bytes = randomBytes(ENTITY_ID_LENGTH);
  return Array.from(
    bytes,
    (byte) => ENTITY_ID_ALPHABET[byte % ENTITY_ID_ALPHABET.length],
  ).join("");
}

export function generateEntityIds(count: number): string[] {
  const ids = new Set<string>();
  while (ids.size < count) {
    ids.add(generateEntityId());
  }
  return [...ids];
}

export async function generateUniqueEntityId(
  exists: (id: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt++) {
    const id = generateEntityId();
    if (!(await exists(id))) {
      return id;
    }
  }

  throw new Error("Не удалось сгенерировать уникальный идентификатор");
}
