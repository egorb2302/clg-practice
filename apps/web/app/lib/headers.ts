export function pageHeaders({ loaderHeaders, parentHeaders }: { loaderHeaders: Headers; parentHeaders: Headers }) {
  const h = new Headers(loaderHeaders);
  if (parentHeaders.get("Cache-Control")?.includes("no-store")) h.set("Cache-Control", "no-store");
  return h;
}
