'use client';

import imageCompression from 'browser-image-compression';
import { COMPRESSION_MAX_SIZE_MB, COMPRESSION_MAX_WIDTH, COMPRESSION_QUALITY } from '@/lib/constants';

/**
 * Compress an image file before upload.
 * Reduces file size to ~1MB, max 1600px width, 80% quality.
 */
export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: COMPRESSION_MAX_SIZE_MB,
    maxWidthOrHeight: COMPRESSION_MAX_WIDTH,
    initialQuality: COMPRESSION_QUALITY,
    useWebWorker: true,
    fileType: file.type as string,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    // Return as File object with original name
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('[Compression] Failed, using original file:', error);
    return file; // Fallback to original if compression fails
  }
}

/**
 * Get compression stats for UI display
 */
export function getCompressionStats(original: File, compressed: File) {
  const originalSize = (original.size / (1024 * 1024)).toFixed(2);
  const compressedSize = (compressed.size / (1024 * 1024)).toFixed(2);
  const reduction = ((1 - compressed.size / original.size) * 100).toFixed(0);

  return {
    originalSize: `${originalSize} MB`,
    compressedSize: `${compressedSize} MB`,
    reduction: `${reduction}%`,
  };
}
