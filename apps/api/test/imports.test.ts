import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });

describe("runtime imports", () => {
  it("uses explicit .js extensions for relative imports, as plain Node ESM on Vercel requires", () => {
    const bad = files(join(import.meta.dirname, "..", "src")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/(?:from\s+|import\s*\(\s*)"(\.\.?\/[^"]*)"/g)]
        .map((m) => m[1]!)
        .filter((spec) => !/\.(js|json|mjs)$/.test(spec))
        .map((spec) => `${file}: ${spec}`),
    );
    expect(bad).toEqual([]);
  });
});
