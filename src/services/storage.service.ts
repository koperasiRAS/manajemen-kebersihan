import { createClient } from '@/lib/supabase/client';
import { STORAGE_BUCKET, SIGNED_URL_EXPIRY, MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';
import { generateFileName, validateImageFile } from '@/lib/utils';

const supabase = createClient();

export const storageService = {
  /**
   * Upload a photo to Supabase Storage
   */
  async uploadPhoto(userId: string, file: File): Promise<string> {
    // Validate file
    const validation = validateImageFile(file, MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileName = generateFileName(userId, file.name);

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Return the path (not public URL since bucket is private)
    return fileName;
  },

  /**
   * Get a signed URL for a photo
   */
  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Get multiple signed URLs
   */
  async getSignedUrls(paths: string[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();

    const promises = paths.map(async (path) => {
      try {
        const url = await this.getSignedUrl(path);
        urlMap.set(path, url);
      } catch {
        urlMap.set(path, '');
      }
    });

    await Promise.all(promises);
    return urlMap;
  },
};
