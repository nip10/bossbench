import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { UiShell } from "../core/ui-shell";

const endpoint = window.location.pathname.replace(/\/[^/]*$/, "");

interface Config {
  title?: string;
  readonly?: boolean;
  hasBoss?: boolean;
}

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [data, setData] = useState<unknown>(null);
  const screen = window.location.hash.slice(2) || "overview";
  useEffect(() => {
    fetch(`${endpoint}/api/config`)
      .then((r) => r.json())
      .then(setConfig);
  }, []);
  useEffect(() => {
    fetch(`${endpoint}/api/${screen === "overview" ? "overview" : screen}`)
      .then((r) => r.json())
      .then(setData);
  }, [screen]);
  const body = useMemo(
    () => (
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    ),
    [data],
  );
  return (
    <UiShell
      title={config?.title ?? "Bossbench"}
      readonly={!!config?.readonly}
      hasBoss={!!config?.hasBoss}
      screen={screen}
    >
      {body}
    </UiShell>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(<App />);
