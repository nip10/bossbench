const root = document.getElementById("root");

if (!root) throw new Error("Root element not found");

root.innerHTML = `
  <main style="min-height:100vh;background:#08090a;color:#f7f7f8;font-family:Inter,ui-sans-serif,system-ui,sans-serif;padding:64px 24px;">
    <section style="max-width:960px;margin:0 auto;display:grid;gap:28px;">
      <p style="color:#9ca3af;text-transform:uppercase;letter-spacing:.16em;font-size:12px;margin:0;">Bossbench</p>
      <h1 style="font-size:clamp(44px,8vw,92px);line-height:.92;margin:0;letter-spacing:-.07em;">A Workbench-style dashboard for pg-boss.</h1>
      <p style="font-size:20px;line-height:1.6;color:#cbd5e1;max-width:720px;margin:0;">Embed queue, job, schedule, warning, dead-letter, and metrics views directly inside Hono or Express apps. SQL-backed reads, pg-boss-backed actions, and auth by default.</p>
      <pre style="background:#111827;border:1px solid #263244;border-radius:18px;padding:18px;overflow:auto;"><code>npx @bossbench/cli init</code></pre>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
        ${["Hono + Express adapters", "Postgres read model", "pg-boss mutations", "Workbench-inspired UI"].map((item) => `<div style="border:1px solid #263244;background:#0f172a;border-radius:18px;padding:18px;">${item}</div>`).join("")}
      </div>
    </section>
  </main>
`;
