"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

export function CopyCommand({
  command,
  variant = "button",
}: {
  command: string;
  variant?: "button" | "inline";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };

  if (variant === "inline") {
    return (
      <button type="button" onClick={copy} className="copy-command inline">
        <span>{command}</span>
        {copied ? (
          <CheckIcon className="icon" />
        ) : (
          <CopyIcon className="icon" />
        )}
      </button>
    );
  }

  return (
    <button type="button" onClick={copy} className="copy-command">
      <span className="prefix">$</span>
      <span>{command}</span>
      {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
    </button>
  );
}
