export function parseScheduleDataInput(input: string): unknown | undefined {
  if (!input.trim()) return undefined;

  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Invalid schedule JSON data");
  }
}
