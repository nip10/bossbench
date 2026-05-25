import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { UI_DIST_PATH } from "../ui-dist";

export interface StaticAssetResult {
  status: 200 | 404;
  body: Buffer | null;
  contentType: string;
}

const ASSETS_ROOT = resolve(UI_DIST_PATH, "assets");
const INDEX_PATH = resolve(UI_DIST_PATH, "index.html");

export function serveStaticAsset(filename: string): StaticAssetResult {
  const normalized = filename.replaceAll("\\", "/");
  const resolved = resolve(ASSETS_ROOT, normalized);
  if (
    !isWithinRoot(ASSETS_ROOT, resolved) ||
    !existsSync(resolved) ||
    !isFile(resolved)
  ) {
    return { status: 404, body: null, contentType: "text/plain" };
  }

  return {
    status: 200,
    body: readFileSync(resolved),
    contentType: contentTypeFor(resolved),
  };
}

export interface IndexHtmlResult {
  body: string;
  contentType: "text/html; charset=utf-8";
}

export function renderIndexHtml(
  basePath: string,
  title: string,
): IndexHtmlResult {
  const html = existsSync(INDEX_PATH)
    ? readFileSync(INDEX_PATH, "utf8")
    : fallbackHtml(title, basePath);

  return {
    body: injectBaseHref(html, basePath),
    contentType: "text/html; charset=utf-8",
  };
}

function isWithinRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function injectBaseHref(html: string, basePath: string): string {
  return html.includes("<head>")
    ? html.replace("<head>", `<head>\n    <base href="${basePath}">`)
    : html;
}

function fallbackHtml(title: string, basePath: string): string {
  return `<!doctype html><html><head><base href="${basePath}"><title>${title}</title></head><body><div id="root"></div></body></html>`;
}
