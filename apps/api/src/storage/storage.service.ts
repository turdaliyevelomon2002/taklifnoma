import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';

/**
 * S3-mos storage (AWS S3, MinIO, Cloudflare R2, Yandex Object Storage ...).
 * Fayllar unikal kalit bilan yoziladi va o'zgarmaydi, shuning uchun uzoq muddatli kesh qo'yiladi.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(config: AppConfig) {
    this.bucket = config.get('S3_BUCKET');
    this.publicBase = config.get('S3_PUBLIC_URL');
    this.client = new S3Client({
      region: config.get('S3_REGION'),
      endpoint: config.get('S3_ENDPOINT'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY'),
        secretAccessKey: config.get('S3_SECRET_KEY'),
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  /** Xatoni tashlamaydi: DB yozuvi allaqachon o'chirilgan, yetim fayl ilovani buzmaydi. */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      for (let i = 0; i < keys.length; i += 1000) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
          }),
        );
      }
    } catch (err) {
      this.logger.warn(`S3 fayllarini o'chirib bo'lmadi (${keys.length} ta): ${String(err)}`);
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
