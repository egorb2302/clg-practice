import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("catalog", "routes/catalog.tsx"),
  route("catalog/:slug", "routes/product.tsx"),
  route("selection", "routes/selection.tsx"),
  route("about", "routes/about.tsx"),
  route("contacts", "routes/contacts.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  // same-origin API: mock handler (API_MOCK=1) or a proxy to API_ORIGIN
  route("api/v1/*", "routes/api.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
