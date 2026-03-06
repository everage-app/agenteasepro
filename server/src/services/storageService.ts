/**
 * Storage service abstraction — local filesystem or S3.
 *
 * Toggle via env:
 *   STORAGE_BACKEND=s3  →  AWS S3 (requires AWS_S3_BUCKET, AWS_REGION, and IAM creds)
 *   STORAGE_BACKEND=local (default) → local disk (existing behaviour)
 *
 * Every uploaded file gets a deterministic `key` (e.g. "logos/logo-abc-123.png").
 * `getPublicUrl(key)` returns a URL the browser can fetch.
 */
import path from 'path';
import fs from 'fs';

// --------------- types ---------------
export interface StorageFile {
  key: string;      // relative path / S3 key
  url: string;      // public URL
}

export interface StorageBackend {
  put(key: string, body: Buffer | NodeJS.ReadableStream, contentType: string): Promise<StorageFile>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
}

// --------------- helpers ---------------
const BACKEND = (process.env.STORAGE_BACKEND || 'local').toLowerCase();

function getLocalBaseDir(): string {
  const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';
  return process.env.NODE_ENV === 'production'
    ? path.join(tmpDir, 'agentease-uploads')
    : path.join(__dirname, '../../uploads');
}

// --------------- local backend ---------------
class LocalStorage implements StorageBackend {
  async put(key: string, body: Buffer | NodeJS.ReadableStream, _contentType: string): Promise<StorageFile> {
    const fullPath = path.join(getLocalBaseDir(), key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (Buffer.isBuffer(body)) {
      fs.writeFileSync(fullPath, body);
    } else {
      await new Promise<void>((resolve, reject) => {
        const ws = fs.createWriteStream(fullPath);
        (body as NodeJS.ReadableStream).pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
      });
    }
    return { key, url: this.getPublicUrl(key) };
  }

  getPublicUrl(key: string): string {
    // Serve via /uploads/* static route
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(getLocalBaseDir(), key);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
}

// --------------- S3 backend (lazy-loaded) ---------------
let s3Instance: StorageBackend | null = null;

function getS3Backend(): StorageBackend {
  if (s3Instance) return s3Instance;

  // AWS SDK v3 — import dynamically so the dep is optional
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_REGION || 'us-east-1';
  const cdnBase = process.env.AWS_CDN_URL; // optional CloudFront

  const client = new S3Client({ region });

  const backend: StorageBackend = {
    async put(key, body, contentType) {
      const bufBody = Buffer.isBuffer(body)
        ? body
        : await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            (body as NodeJS.ReadableStream).on('data', (c: Buffer) => chunks.push(c));
            (body as NodeJS.ReadableStream).on('end', () => resolve(Buffer.concat(chunks)));
            (body as NodeJS.ReadableStream).on('error', reject);
          });

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bufBody,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return { key, url: backend.getPublicUrl(key) };
    },

    getPublicUrl(key) {
      if (cdnBase) return `${cdnBase}/${key}`;
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };

  s3Instance = backend;
  return backend;
}

// --------------- singleton export ---------------
export function getStorage(): StorageBackend {
  return BACKEND === 's3' ? getS3Backend() : new LocalStorage();
}

export const storage = getStorage();
