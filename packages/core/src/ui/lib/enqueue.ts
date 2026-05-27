export function parseEnqueuePayloadInput(
  payloadInput: string,
  priorityInput = "",
): {
  data: Record<string, unknown>;
  options?: { priority: number };
} {
  const data = parseJsonObjectPayload(payloadInput);
  const priority = parsePriorityInput(priorityInput);

  return priority === undefined ? { data } : { data, options: { priority } };
}

function parseJsonObjectPayload(input: string): Record<string, unknown> {
  if (!input.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Invalid enqueue JSON payload");
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Enqueue payload must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function parsePriorityInput(input: string): number | undefined {
  if (!input.trim()) return undefined;

  if (!/^[+-]?\d+$/.test(input.trim())) {
    throw new Error("Priority must be an integer");
  }

  const priority = Number(input.trim());
  if (!Number.isSafeInteger(priority)) {
    throw new Error("Priority must be an integer");
  }

  return priority;
}
