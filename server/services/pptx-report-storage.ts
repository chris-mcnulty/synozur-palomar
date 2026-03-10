import { Storage } from "@google-cloud/storage";
import * as fs from 'fs/promises';
import * as path from 'path';

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export class PptxReportStorage {
  private objectStorageClient: Storage | null = null;
  private isProduction: boolean;

  constructor() {
    this.isProduction =
      process.env.REPLIT_DEPLOYMENT === '1' ||
      process.env.NODE_ENV === 'production';

    if (this.isProduction) {
      this.objectStorageClient = new Storage({
        credentials: {
          audience: "replit",
          subject_token_type: "access_token",
          token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
          type: "external_account",
          credential_source: {
            url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
            format: {
              type: "json",
              subject_token_field_name: "access_token",
            },
          },
          universe_domain: "googleapis.com",
        },
        projectId: "",
      });
    }
  }

  async storePptx(buffer: Buffer, reportId: string, filename: string): Promise<string> {
    if (this.isProduction) {
      return await this.storeInObjectStorage(buffer, reportId, filename);
    } else {
      return await this.storeLocally(buffer, reportId, filename);
    }
  }

  async getPptx(fileId: string): Promise<Buffer> {
    if (this.isProduction) {
      return await this.retrieveFromObjectStorage(fileId);
    } else {
      return await this.retrieveLocally(fileId);
    }
  }

  async deletePptx(fileId: string): Promise<void> {
    try {
      if (this.isProduction) {
        await this.deleteFromObjectStorage(fileId);
      } else {
        await this.deleteLocally(fileId);
      }
    } catch (err: any) {
      console.error(`[PptxReportStorage] Delete failed for ${fileId}:`, err.message);
    }
  }

  private async storeInObjectStorage(buffer: Buffer, reportId: string, filename: string): Promise<string> {
    if (!this.objectStorageClient) {
      throw new Error('Object Storage client not initialized');
    }

    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      throw new Error('PRIVATE_OBJECT_DIR not configured');
    }

    const pathParts = privateObjectDir.split('/').filter(p => p);
    if (pathParts.length < 1) {
      throw new Error('Invalid PRIVATE_OBJECT_DIR format');
    }

    const bucketName = pathParts[0];
    const bucketPath = pathParts.slice(1).join('/');
    const objectPath = `${bucketPath}/status-reports/${reportId}_${filename}`;

    const bucket = this.objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);

    await file.save(buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      metadata: {
        cacheControl: 'private, max-age=3600',
      },
    });

    console.log(`[PptxReportStorage] Stored in Object Storage: ${objectPath}`);
    return objectPath;
  }

  private async retrieveFromObjectStorage(objectPath: string): Promise<Buffer> {
    if (!this.objectStorageClient) {
      throw new Error('Object Storage client not initialized');
    }

    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      throw new Error('PRIVATE_OBJECT_DIR not configured');
    }

    const pathParts = privateObjectDir.split('/').filter(p => p);
    const bucketName = pathParts[0];

    const bucket = this.objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);

    const [contents] = await file.download();
    return contents;
  }

  private async deleteFromObjectStorage(objectPath: string): Promise<void> {
    if (!this.objectStorageClient) {
      throw new Error('Object Storage client not initialized');
    }

    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      throw new Error('PRIVATE_OBJECT_DIR not configured');
    }

    const pathParts = privateObjectDir.split('/').filter(p => p);
    const bucketName = pathParts[0];

    const bucket = this.objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);

    await file.delete();
    console.log(`[PptxReportStorage] Deleted from Object Storage: ${objectPath}`);
  }

  private async storeLocally(buffer: Buffer, reportId: string, filename: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'status-reports');
    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = `${reportId}_${filename}`;
    const filePath = path.join(uploadDir, safeName);
    await fs.writeFile(filePath, buffer);

    console.log(`[PptxReportStorage] Stored locally: ${filePath}`);
    return path.join('status-reports', safeName);
  }

  private async retrieveLocally(fileId: string): Promise<Buffer> {
    const filePath = path.join(process.cwd(), 'uploads', fileId);
    return await fs.readFile(filePath);
  }

  private async deleteLocally(fileId: string): Promise<void> {
    const filePath = path.join(process.cwd(), 'uploads', fileId);
    await fs.unlink(filePath);
    console.log(`[PptxReportStorage] Deleted locally: ${filePath}`);
  }
}

export const pptxReportStorage = new PptxReportStorage();
