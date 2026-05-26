import { cloudinary } from '../config/cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Streams a buffer to Cloudinary and returns the secure URL.
 */
export function uploadBuffer(
  buffer: Buffer,
  folder = 'civic-reporter'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Upload many buffers in parallel, returning their URLs in the same order.
 * Individual failures throw — caller can wrap in try/catch.
 */
export async function uploadMany(
  files: Express.Multer.File[],
  folder = 'civic-reporter'
): Promise<string[]> {
  const results = await Promise.all(
    files.map((f) => uploadBuffer(f.buffer, folder))
  );
  return results.map((r) => r.url);
}
