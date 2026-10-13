// Readers for untrusted JSON from the stream: the wrong type becomes null or a
// default, never a thrown error and never a value of the wrong type.

import type { JsonObject } from "./types";

export function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

export function str(o: JsonObject, key: string): string | null {
  const value = o[key];
  return typeof value === "string" ? value : null;
}

/** A non-empty string, else null. */
export function text(o: JsonObject, key: string): string | null {
  const value = str(o, key);
  return value ? value : null;
}

export function num(o: JsonObject, key: string): number | null {
  const value = o[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function bool(o: JsonObject, key: string): boolean {
  return o[key] === true;
}

export function list(o: JsonObject, key: string): readonly unknown[] {
  const value = o[key];
  return Array.isArray(value) ? value : [];
}

export function strings(o: JsonObject, key: string): readonly string[] {
  return list(o, key).filter((item): item is string => typeof item === "string");
}

export function obj(o: JsonObject, key: string): JsonObject {
  return asObject(o[key]) ?? {};
}

/** JSON.parse that returns undefined instead of throwing. */
export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
