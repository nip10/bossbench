"use client";

import { Check, ChevronRight, Copy } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

export function JsonViewer({
  data,
  className,
  defaultExpanded = true,
}: {
  data: unknown;
  className?: string;
  defaultExpanded?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const copyText = React.useMemo(() => stringifyJson(data), [data]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("json-viewer", className)}>
      <button type="button" className="json-copy" onClick={handleCopy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <div className="json-body">
        <JsonNode data={data} defaultExpanded={defaultExpanded} level={0} />
      </div>
    </div>
  );
}

function JsonNode({
  data,
  level,
  defaultExpanded,
  keyName,
}: {
  data: unknown;
  level: number;
  defaultExpanded: boolean;
  keyName?: string;
}) {
  const [open, setOpen] = React.useState(defaultExpanded);
  const indent = { paddingLeft: `${level * 14}px` };

  if (data === null || data === undefined) {
    return (
      <div className="json-row" style={indent}>
        {keyName ? <Key name={keyName} /> : null}
        <span className="json-null">{String(data)}</span>
      </div>
    );
  }

  if (typeof data === "string") {
    return (
      <div className="json-row" style={indent}>
        {keyName ? <Key name={keyName} /> : null}
        <span className="json-string">"{data}"</span>
      </div>
    );
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return (
      <div className="json-row" style={indent}>
        {keyName ? <Key name={keyName} /> : null}
        <span className="json-primitive">{String(data)}</span>
      </div>
    );
  }

  if (Array.isArray(data)) {
    return (
      <div>
        <button
          type="button"
          className="json-group"
          style={indent}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronRight size={12} className={open ? "open" : ""} />
          {keyName ? <Key name={keyName} /> : null}
          <span className="json-meta">Array({data.length})</span>
        </button>
        {open ? (
          <div className="json-children">
            {data.map((item, index) => (
              <JsonNode
                key={jsonKeyForItem(item, index)}
                data={item}
                level={level + 1}
                defaultExpanded={level < 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <div>
        <button
          type="button"
          className="json-group"
          style={indent}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronRight size={12} className={open ? "open" : ""} />
          {keyName ? <Key name={keyName} /> : null}
          <span className="json-meta">Object({entries.length})</span>
        </button>
        {open ? (
          <div className="json-children">
            {entries.map(([key, value]) => (
              <JsonNode
                key={key}
                data={value}
                level={level + 1}
                defaultExpanded={level < 1}
                keyName={key}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="json-row" style={indent}>
      {keyName ? <Key name={keyName} /> : null}
      <span>{String(data)}</span>
    </div>
  );
}

function Key({ name }: { name: string }) {
  return <span className="json-key">"{name}"</span>;
}

function stringifyJson(data: unknown) {
  const text = JSON.stringify(data, null, 2);
  return text === undefined ? String(data) : text;
}

function jsonKeyForItem(data: unknown, index: number) {
  if (data === null) return `null-${index}`;
  if (data === undefined) return `undefined-${index}`;
  if (typeof data === "object") return `${stringifyJson(data)}-${index}`;
  return `${String(data)}-${index}`;
}
