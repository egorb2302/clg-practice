import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { StorageClient } from "@supabase/storage-js";
import type { Config } from "../config";

export interface StorageAdapter {
  createUploadUrl(path: string): Promise<{ url: string; token?: string }>;
  readUpload(path: string): Promise<Buffer>;
  putPublic(path: string, data: Buffer, contentType: string): Promise<string>;
  writeLocalUpload?(path: string, data: Buffer): Promise<void>;
}

export class LocalStorage implements StorageAdapter {
  private root: string;
  constructor(
    dir: string,
    private apiBase: string,
  ) {
    this.root = resolve(dir);
  }
  private file(kind: "uploads" | "public", path: string) {
    const full = resolve(join(this.root, kind, path));
    if (!full.startsWith(this.root)) throw new Error("bad path");
    return full;
  }
  async createUploadUrl(path: string) {
    return { url: `${this.apiBase}/api/v1/admin/media/local-upload/${encodeURIComponent(path)}` };
  }
  async writeLocalUpload(path: string, data: Buffer) {
    const f = this.file("uploads", path);
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, data);
  }
  async readUpload(path: string) {
    return readFile(this.file("uploads", path));
  }
  async putPublic(path: string, data: Buffer) {
    const f = this.file("public", path);
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, data);
    return `${this.apiBase}/media/${path}`;
  }
  publicDir() {
    return join(this.root, "public");
  }
}

export class SupabaseStorage implements StorageAdapter {
  private client: StorageClient;
  constructor(private cfg: Config) {
    this.client = new StorageClient(`${cfg.SUPABASE_URL}/storage/v1`, {
      apikey: cfg.SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${cfg.SUPABASE_SERVICE_KEY}`,
    });
  }
  async createUploadUrl(path: string) {
    const { data, error } = await this.client.from(this.cfg.STORAGE_UPLOAD_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`storage: ${error?.message ?? "no data"}`);
    return { url: data.signedUrl, token: data.token };
  }
  async readUpload(path: string) {
    const { data, error } = await this.client.from(this.cfg.STORAGE_UPLOAD_BUCKET).download(path);
    if (error || !data) throw new Error(`storage: ${error?.message ?? "no data"}`);
    return Buffer.from(await data.arrayBuffer());
  }
  async putPublic(path: string, data: Buffer, contentType: string) {
    const bucket = this.client.from(this.cfg.STORAGE_PUBLIC_BUCKET);
    const { error } = await bucket.upload(path, data, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`storage: ${error.message}`);
    return bucket.getPublicUrl(path).data.publicUrl;
  }
}

export function createStorage(cfg: Config, apiBase: string): StorageAdapter {
  return cfg.STORAGE_DRIVER === "supabase" ? new SupabaseStorage(cfg) : new LocalStorage(cfg.LOCAL_MEDIA_DIR, apiBase);
}
