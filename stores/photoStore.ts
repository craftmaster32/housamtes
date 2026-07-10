import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export type PhotoCategory = 'receipts' | 'damage' | 'memories' | 'general';

export const PHOTO_CATEGORIES: Array<{ key: PhotoCategory; labelKey: string; icon: string }> = [
  { key: 'general', labelKey: 'photos.cat_all', icon: '📷' },
  { key: 'receipts', labelKey: 'photos.cat_receipts', icon: '🧾' },
  { key: 'damage', labelKey: 'photos.cat_damage', icon: '⚠️' },
  { key: 'memories', labelKey: 'photos.cat_memories', icon: '🎉' },
];

export interface Photo {
  id: string;
  url: string;
  storagePath: string;
  caption: string | null;
  category: PhotoCategory;
  uploadedBy: string;
  userId: string;
  createdAt: string;
}

// The DB stores the canonical bucket URL (…/house-photos/{path}). The bucket
// is private, so display goes through short-lived signed URLs instead — this
// extracts the object path used both for signing and for deletes.
export function storagePathFromUrl(url: string): string | null {
  const match = url.match(/house-photos\/(.+)$/);
  if (!match) return null;
  const path = match[1].split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

interface PhotoStore {
  photos: Photo[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  upload: (params: {
    localUri: string;
    fileName: string;
    mimeType: string;
    caption: string;
    category: PhotoCategory;
    uploadedBy: string;
    userId: string;
    houseId: string;
  }) => Promise<void>;
  remove: (id: string, storagePath: string) => Promise<void>;
}

const BUCKET = 'house-photos';

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const usePhotoStore = create<PhotoStore>()(
  devtools(
    (set, get) => ({
      photos: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[photos] house ID mismatch — aborting load');
          return;
        }
        try {
          const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const rows = data ?? [];

          // Sign all photo URLs in one batch — the bucket is private, so the
          // stored URL is only usable as a path reference, not for display.
          const paths = rows.map((r) => storagePathFromUrl(r.url));
          const validPaths = paths.filter((p): p is string => p !== null);
          const signedByPath = new Map<string, string>();
          if (validPaths.length > 0) {
            const { data: signed, error: signError } = await supabase.storage
              .from(BUCKET)
              .createSignedUrls(validPaths, 60 * 60 * 24 * 7);
            if (signError) {
              captureError(signError, { store: 'photos', context: 'sign-urls', houseId });
            }
            for (const s of signed ?? []) {
              if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
            }
          }

          const photos: Photo[] = rows.map((r, i) => {
            const path = paths[i];
            return {
              id: r.id,
              url: (path && signedByPath.get(path)) || r.url,
              storagePath: path ?? '',
              caption: r.caption ?? null,
              category: r.category as PhotoCategory,
              uploadedBy: r.uploaded_by,
              userId: r.user_id,
              createdAt: r.created_at,
            };
          });
          set({ photos, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'photos', houseId });
          set({ isLoading: false, error: 'Could not load photos. Please try again.' });
        }

        if (_channel) {
          supabase.removeChannel(_channel);
        }
        _channel = supabase
          .channel(`photos:${houseId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'photos', filter: `house_id=eq.${houseId}` },
            () => {
              get().load(houseId);
            }
          )
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
        }
      },
      upload: async ({
        localUri,
        fileName,
        mimeType,
        caption,
        category,
        uploadedBy,
        userId,
        houseId,
      }): Promise<void> => {
        // Read file as ArrayBuffer via fetch
        const response = await fetch(localUri);
        const blob = await response.blob();
        if (blob.size > 20 * 1024 * 1024)
          throw new Error('Photo must be under 20 MB. Please choose a smaller image.');
        const path = `${houseId}/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: mimeType, upsert: false });
        if (uploadError) {
          captureError(uploadError, { context: 'photo-upload', houseId });
          throw new Error('Could not upload the photo. Please try again.');
        }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const url = urlData.publicUrl;

        const { error: insertError } = await supabase.from('photos').insert({
          house_id: houseId,
          url,
          caption: caption || null,
          category,
          uploaded_by: uploadedBy,
          user_id: userId,
        });
        if (insertError) {
          captureError(insertError, { context: 'photo-insert', houseId });
          throw new Error('Could not save the photo. Please try again.');
        }
      },
      remove: async (id, storagePath): Promise<void> => {
        if (storagePath) {
          // Best-effort file delete, but surface bucket/RLS failures to Sentry
          // instead of silently orphaning the object while the row disappears.
          const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
          if (storageError) {
            captureError(storageError, { context: 'delete-photo', photoId: id });
          }
        }
        const { error } = await supabase.from('photos').delete().eq('id', id);
        if (error) {
          captureError(error, { context: 'delete-photo', photoId: id });
          throw new Error('Could not delete the photo. Please try again.');
        }
        set({ photos: get().photos.filter((p) => p.id !== id) });
      },
    }),
    { name: 'photo-store' }
  )
);
