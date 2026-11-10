import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { StorageClient } from "@supabase/storage-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const out = process.argv[2] ?? "media-backup";
const buckets = (process.env.BACKUP_BUCKETS ?? "catalog,uploads").split(",").map((b) => b.trim()).filter(Boolean);
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");

const client = new StorageClient(`${url}/storage/v1`, { apikey: key, Authorization: `Bearer ${key}` });

async function walk(bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await walk(bucket, path)));
      else files.push(path);
    }
    if (data.length < 100) break;
  }
  return files;
}

let total = 0;
for (const bucket of buckets) {
  for (const path of await walk(bucket, "")) {
    const { data, error } = await client.from(bucket).download(path);
    if (error || !data) throw new Error(`download ${bucket}/${path}: ${error?.message ?? "no data"}`);
    const target = join(out, bucket, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    total++;
  }
}
console.log(`downloaded ${total} files`);
