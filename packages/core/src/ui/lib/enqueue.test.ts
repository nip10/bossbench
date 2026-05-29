import { describe, expect, it } from "vitest";
import { parseEnqueuePayloadInput } from "./enqueue";

describe("parseEnqueuePayloadInput", () => {
  it("parses empty payloads as an empty object", () => {
    expect(parseEnqueuePayloadInput("", "")).toEqual({ data: {} });
    expect(parseEnqueuePayloadInput("   ")).toEqual({ data: {} });
  });

  it("parses JSON objects and optional integer priority", () => {
    expect(parseEnqueuePayloadInput('{"foo":1}', "7")).toEqual({
      data: { foo: 1 },
      options: { priority: 7 },
    });
  });

  it("rejects invalid JSON with a clear message", () => {
    expect(() => parseEnqueuePayloadInput("{", "")).toThrow(
      "Invalid enqueue JSON payload",
    );
  });

  it("rejects arrays and scalars", () => {
    expect(() => parseEnqueuePayloadInput("[]", "")).toThrow(
      "Enqueue payload must be a JSON object",
    );
    expect(() => parseEnqueuePayloadInput("123", "")).toThrow(
      "Enqueue payload must be a JSON object",
    );
    expect(() => parseEnqueuePayloadInput("null", "")).toThrow(
      "Enqueue payload must be a JSON object",
    );
  });

  it("rejects non-integer priority values", () => {
    expect(() => parseEnqueuePayloadInput("{}", "1.5")).toThrow(
      "Priority must be an integer",
    );
    expect(() => parseEnqueuePayloadInput("{}", "high")).toThrow(
      "Priority must be an integer",
    );
  });
});
