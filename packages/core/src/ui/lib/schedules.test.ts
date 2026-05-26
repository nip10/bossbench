import { describe, expect, it } from "vitest";
import { parseScheduleDataInput } from "./schedules";

describe("parseScheduleDataInput", () => {
  it("returns undefined for empty or whitespace input", () => {
    expect(parseScheduleDataInput("")).toBeUndefined();
    expect(parseScheduleDataInput("   \n\t  ")).toBeUndefined();
  });

  it("parses valid JSON data", () => {
    expect(parseScheduleDataInput('{"foo":1,"bar":[true,null]}')).toEqual({
      foo: 1,
      bar: [true, null],
    });
  });

  it("throws for invalid JSON data", () => {
    expect(() => parseScheduleDataInput("{foo:1}")).toThrow(
      "Invalid schedule JSON data",
    );
  });
});
