import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

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
  caption: string | null;
  category: PhotoCategory;
  uploadedBy: string;
  userId: string;
  createdAt: string;
}

interface PhotoStore {
  photos: Photo[];
  isLoading: boolean;
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

function storagePathFromUrl(url: string): string {
  // Extract the path after /storage/v1/object/public/{bucket}/
  const match = url.match(/house-photos\/(.+)$/);
  return match ? match[1] : '';
}

export const usePhotoStore = create<PhotoStore>()(
  devtools(
    (set, get) => ({
      photos: [],
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
        try {
          const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const photos: Photo[] = (data ?? []).map((r) => ({
            id: r.id,
            url: r.url,
            caption: r.caption ?? null,
            category: r.category as PhotoCategory,
            uploadedBy: r.uploaded_by,
            userId: r.user_id,
            createdAt: r.created_at,
          }));
          set({ photos, isLoading: false });
        } catch {
          set({ isLoading: false });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`photos:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      upload: async ({ localUri, fileName, mimeType, caption, category, uploadedBy, userId, houseId }): Promise<void> => {
        // Read file as ArrayBuffer via fetch
        const response = await fetch(localUri);
        const blob = await response.blob();
        const path = `${houseId}/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: mimeType, upsert: false });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

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
        if (insertError) throw new Error(`Failed to save photo: ${insertError.message}`);
      },
      remove: async (id, storagePath): Promise<void> => {
        if (storagePath) {
          await supabase.storage.from(BUCKET).remove([storagePath]);
        }
        const { error } = await supabase.from('photos').delete().eq('id', id);
        if (error) throw new Error(`Failed to delete photo: ${error.message}`);
        set({ photos: get().photos.filter((p) => p.id !== id) });
      },
    }),
    { name: 'photo-store' }
  )
);
