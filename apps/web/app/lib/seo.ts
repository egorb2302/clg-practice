import type { MetaDescriptor } from "react-router";

type Opts = { title: string; description: string; path: string; origin?: string; image?: string; noindex?: boolean };

/** title, description, canonical, Open Graph and Twitter Card for every public page */
export function seo({ title, description, path, origin = "", image = "/og/armorix-default-v1.jpg", noindex }: Opts): MetaDescriptor[] {
  const url = `${origin}${path}`;
  const img = image.startsWith("http") ? image : `${origin}${image}`;
  const full = title.includes("ARMORIX") ? title : `${title} | ARMORIX`;
  return [
    { title: full },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "ARMORIX" },
    { property: "og:locale", content: "ru_RU" },
    { property: "og:title", content: full },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: img },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: full },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
    ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

/** origin from the root loader, available to every route's meta */
export function rootOrigin(matches: readonly unknown[]): string {
  const root = matches.find((m) => (m as { id?: string })?.id === "root") as { loaderData?: { origin?: string }; data?: { origin?: string } } | undefined;
  return root?.loaderData?.origin ?? root?.data?.origin ?? "";
}
