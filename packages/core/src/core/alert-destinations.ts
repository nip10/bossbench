import { buildWebhookPayload } from "./alert-delivery";
import type {
  BossbenchAlertContactPointType,
  BossbenchAlertSeverity,
  BossbenchAlertViolation,
} from "./types";

export function buildSlackPayload(violation: BossbenchAlertViolation) {
  const title = alertTitle(violation);
  return {
    text: title,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: title },
      },
      {
        type: "section",
        fields: alertFields(violation).map(([label, value]) => ({
          type: "mrkdwn",
          text: `*${label}:*\n${value}`,
        })),
      },
    ],
  };
}

export function buildDiscordPayload(violation: BossbenchAlertViolation) {
  return {
    embeds: [
      {
        title: alertTitle(violation),
        color: severityColor(violation.severity),
        fields: alertFields(violation).map(([name, value]) => ({
          name,
          value,
          inline: true,
        })),
        timestamp: violation.observedAt,
      },
    ],
  };
}

export function buildDestinationPayload(
  type: BossbenchAlertContactPointType,
  violation: BossbenchAlertViolation,
) {
  if (type === "slack") return buildSlackPayload(violation);
  if (type === "discord") return buildDiscordPayload(violation);
  return buildWebhookPayload(violation);
}

function alertTitle(violation: BossbenchAlertViolation) {
  return `${capitalize(violation.severity)} Bossbench alert: ${violation.ruleName}`;
}

function alertFields(violation: BossbenchAlertViolation) {
  return [
    ["Rule", violation.ruleId],
    ["Type", violation.type],
    ["Queue", violation.queue ?? "all queues"],
    ["Current", String(violation.current)],
    ["Threshold", String(violation.threshold)],
    [
      "Window",
      violation.windowMinutes ? `${violation.windowMinutes}m` : "current",
    ],
  ] as const;
}

function severityColor(severity: BossbenchAlertSeverity) {
  if (severity === "critical") return 0xdc2626;
  if (severity === "warning") return 0xf59e0b;
  return 0x2563eb;
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
