import { Storage } from "@google-cloud/storage";
import * as fs from "fs/promises";
import * as fssync from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_ROOT = path.join(__dirname, "..", "..", "uploads", "support_attachments");

export interface StoredAttachment {
  storageKey: string;
  storageBackend: "local" | "object_storage";
  size: number;
}

class SupportAttachmentStorage {
  private gcs: Storage | null = null;
  private isProd: boolean;
  private bucketName: string;

  constructor() {
    this.isProd = process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production";
    this.bucketName = process.env.SUPPORT_ATTACHMENT_BUCKET || process.env.OBJECT_STORAGE_BUCKET || "";
    if (this.isProd && this.bucketName) {
      this.gcs = new Storage({
        credentials: {
          audience: "replit",
          subject_token_type: "access_token",
          token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
          type: "external_account",
          credential_source: {
            url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
            format: { type: "json", subject_token_field_name: "access_token" },
          },
          universe_domain: "googleapis.com",
        } as any,
        projectId: "",
      });
    }
  }

  async store(buffer: Buffer, fileName: string, contentType: string, ticketId: string): Promise<StoredAttachment> {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "attachment";
    const id = randomUUID();
    const key = `support/${ticketId}/${id}_${safe}`;

    if (this.gcs && this.bucketName) {
      const bucket = this.gcs.bucket(this.bucketName);
      const file = bucket.file(key);
      await file.save(buffer, { contentType, resumable: false });
      return { storageKey: key, storageBackend: "object_storage", size: buffer.length };
    }

    // Local fallback
    const dir = path.join(LOCAL_ROOT, ticketId);
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, `${id}_${safe}`);
    await fs.writeFile(fullPath, buffer);
    return { storageKey: path.relative(LOCAL_ROOT, fullPath), storageBackend: "local", size: buffer.length };
  }

  async load(storageKey: string, backend: string): Promise<{ stream: NodeJS.ReadableStream; size?: number } | null> {
    if (backend === "object_storage") {
      if (!this.gcs || !this.bucketName) return null;
      const file = this.gcs.bucket(this.bucketName).file(storageKey);
      const [exists] = await file.exists();
      if (!exists) return null;
      return { stream: file.createReadStream() };
    }
    const fullPath = path.join(LOCAL_ROOT, storageKey);
    try {
      const stat = await fs.stat(fullPath);
      return { stream: fssync.createReadStream(fullPath), size: stat.size };
    } catch {
      return null;
    }
  }
}

export const supportAttachmentStorage = new SupportAttachmentStorage();
