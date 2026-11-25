import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';

/**
 * S3-mos storage (SeaweedFS, AWS S3, Cloudflare R2, Yandex Object Storage ...).
 * Bucket yo'q bo'lsa ilova ishga tushganda o'zi yaratadi (alohida init konteyner kerak emas).
 * Fayllar unikal kalit bilan yoziladi va o'zgarmaydi, shuning uchun uzoq muddatli kesh qo'yiladi.
 */
@Injectable()
export class StorageService implements OnApplicationBootstrap, OnModuleDestroy {
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

  /** Ishga tushishni to'xtatmaydi: storage kechikib ko'tarilsa, bir necha marta qayta urinadi. */
  onApplicationBootstrap(): void {
    void this.ensureBucket();
  }

  private async ensureBucket(attempts = 10): Promise<void> {
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        return;
      } catch (err) {
        const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) {
          try {
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
            this.logger.log(`S3 bucket yaratildi: ${this.bucket}`);
            return;
          } catch (createErr) {
            this.logger.warn(`S3 bucket yaratib bo'lmadi: ${String(createErr)}`);
          }
        }
        if (i === attempts) {
          this.logger.error(`S3 storage'ga ulanib bo'lmadi (${this.bucket}): ${String(err)}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
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
