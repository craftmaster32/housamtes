import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';

// Product photos share the private house-photos bucket. Paths follow its
// storage policy: "<house_id>/<13+ digit timestamp>_<name>".
const BUCKET = 'house-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const PHOTO_WIDTH = 640;
// Matches the grocery_product_photos.name_key column limit. Lowercasing can
// expand a string (e.g. İ → 2 chars), so we check the normalised key.
const NAME_KEY_MAX_LENGTH = 200;

export interface ProductPhoto {
  path: string;
  url: string;
}

/** The key a photo is remembered under: "  Oat  Milk " and "oat milk" match. */
export function productPhotoKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface GroceryPhotoStore {
  /** Photos by productPhotoKey(name). */
  photos: Record<string, ProductPhoto>;
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  /** Shrinks the picked image, uploads it and remembers it for this item name. */
  setPhoto: (params: {
    houseId: string;
    name: string;
    localUri: string;
    userId: string;
  }) => Promise<void>;
  removePhoto: (houseId: string, name: string) => Promise<void>;
  /**
   * Keeps the photo with an item that was renamed: the new name gets the same
   * picture (unless it already has its own). Never throws — a rename must not
   * fail because of its photo.
   */
  carryPhoto: (params: {
    houseId: string;
    fromName: string;
    toName: string;
    userId: string;
  }) => Promise<void>;
  clearError: () => void;
}

function removeObject(path: string): void {
  supabase.storage
    .from(BUCKET)
    .remove([path])
    .then(({ error }) => {
      if (error) captureError(error, { context: 'grocery-photo-cleanup' });
    })
    .catch((err: unknown) => captureError(err, { context: 'grocery-photo-cleanup' }));
}

/**
 * Query the DB to check whether any row still references this storage path.
 * Fail-safe: returns true (do not delete) when the query itself fails.
 */
async function isPathReferencedInDb(path: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('grocery_product_photos')
    .select('*', { count: 'exact', head: true })
    .eq('storage_path', path);
  if (error) return true;
  return (count ?? 0) > 0;
}

let loadGeneration = 0;
// The houseId passed to the most-recent load() call.  Mutations use this to
// avoid writing household A's photo into household B's cache when the active
// household changes while a network call is in-flight.
let loadHouseId = '';
// Mutations applied while a load is in-flight (key → photo, or null = removed).
// Applied on top of the loaded snapshot so a completed load cannot discard
// photos added or removed after the DB query was sent.
// Null-prototype prevents __proto__ from corrupting Object.prototype.
const mutationOverlay: Record<string, ProductPhoto | null> = Object.create(
  null
) as Record<string, ProductPhoto | null>;
// Per-key save generation: prevents a stale concurrent save from overwriting a
// newer one's result in the cache.
const saveGeneration: Record<string, number> = Object.create(null) as Record<string, number>;

export const useGroceryPhotoStore = create<GroceryPhotoStore>()(
  devtools(
    (set, get) => ({
      photos: {},
      isLoading: false,
      error: null,

      load: async (houseId): Promise<void> => {
        if (!houseId) return;
        const generation = ++loadGeneration;
        const isNewHousehold = houseId !== loadHouseId;
        loadHouseId = houseId;
        // Clear the overlay so stale mutations from a prior household cannot
        // bleed into this load. Any mutations that follow will be tracked fresh.
        for (const k of Object.keys(mutationOverlay)) delete mutationOverlay[k];
        // Clear the cache immediately when switching households so in-flight
        // saves cannot read a stale household's entries as a replacement target.
        if (isNewHousehold) {
          set({ photos: {}, isLoading: true, error: null });
        } else {
          set({ isLoading: true, error: null });
        }
        try {
          const { data, error } = await supabase
            .from('grocery_product_photos')
            .select('name_key, storage_path')
            .eq('house_id', houseId);
          if (error) throw error;
          const rows = (data ?? []) as Array<{ name_key: string; storage_path: string }>;
          const photos: Record<string, ProductPhoto> = Object.create(null) as Record<
            string,
            ProductPhoto
          >;
          if (rows.length > 0) {
            const { data: signed, error: signError } = await supabase.storage
              .from(BUCKET)
              .createSignedUrls(
                rows.map((r) => r.storage_path),
                SIGNED_URL_TTL_SECONDS
              );
            if (signError) throw signError;
            rows.forEach((r, i) => {
              const url = signed?.[i]?.signedUrl;
              if (url) photos[r.name_key] = { path: r.storage_path, url };
            });
          }
          if (generation !== loadGeneration) return;
          // Reconcile mutations that completed after the DB query was dispatched.
          for (const [k, v] of Object.entries(mutationOverlay)) {
            if (v === null) delete photos[k];
            else photos[k] = v;
          }
          for (const k of Object.keys(mutationOverlay)) delete mutationOverlay[k];
          set({ photos, isLoading: false });
        } catch (err) {
          captureError(err, { context: 'grocery-photo-load', houseId });
          if (generation !== loadGeneration) return;
          // Preserve the current cache on a refresh failure so successful saves
          // remain visible. The photos are already empty when this is the first
          // load for a new household (cleared synchronously above).
          set({ isLoading: false, error: 'Could not load product photos.' });
        }
      },

      setPhoto: async ({ houseId, name, localUri, userId }): Promise<void> => {
        const key = productPhotoKey(name);
        if (!key) throw new Error('Give the item a name first.');
        if ([...key].length > NAME_KEY_MAX_LENGTH) throw new Error('Item name is too long.');
        // Capture before any network calls so cleanup works even if the
        // household switches while the upload is in-flight.
        const oldPathForCleanup = get().photos[key]?.path ?? null;
        // Track per-key save order so a slower older save cannot overwrite a
        // faster newer one in the cache.
        const thisSaveGen = (saveGeneration[key] = (saveGeneration[key] ?? 0) + 1);
        try {
          const small = await ImageManipulator.manipulateAsync(
            localUri,
            [{ resize: { width: PHOTO_WIDTH } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          const blob = await (await fetch(small.uri)).blob();
          const rand = Math.random().toString(36).slice(2, 8);
          const path = `${houseId}/${Date.now()}_grocery_${rand}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (uploadError) throw uploadError;

          // Obtain signed URL before the upsert so a signing failure cannot
          // leave the DB pointing at a path the cache doesn't track.
          const { data: signed, error: signError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
          if (signError || !signed?.signedUrl) {
            removeObject(path);
            throw signError ?? new Error('No signed URL');
          }

          const { error: rowError } = await supabase
            .from('grocery_product_photos')
            .upsert(
              { house_id: houseId, name_key: key, storage_path: path, added_by: userId },
              { onConflict: 'house_id,name_key' }
            );
          if (rowError) {
            removeObject(path);
            throw rowError;
          }

          // Only update cache/overlay when the active household has not changed
          // since this mutation was started, so a stale completion cannot write
          // household A's photo into household B's cache. Also skip if a newer
          // concurrent save for the same key has already committed.
          const isCurrentHousehold = houseId === loadHouseId;
          if (isCurrentHousehold && saveGeneration[key] === thisSaveGen) {
            const updatedPhotos = Object.assign(
              Object.create(null) as Record<string, ProductPhoto>,
              get().photos
            );
            updatedPhotos[key] = { path, url: signed.signedUrl };
            set({ photos: updatedPhotos });
            mutationOverlay[key] = { path, url: signed.signedUrl };
          }
          // Cleanup is independent of the household guard: the old path was
          // captured synchronously before any network calls, so it belongs to
          // this household's prior entry.
          if (oldPathForCleanup && oldPathForCleanup !== path) {
            const stillReferenced = await isPathReferencedInDb(oldPathForCleanup);
            if (!stillReferenced) removeObject(oldPathForCleanup);
          }
        } catch (err) {
          captureError(err, { context: 'grocery-photo-upload', houseId });
          throw new Error('Could not save the photo. Please try again.');
        }
      },

      removePhoto: async (houseId, name): Promise<void> => {
        const key = productPhotoKey(name);
        const old = get().photos[key];
        if (!old) return;
        try {
          const { data: deletedRows, error } = await supabase
            .from('grocery_product_photos')
            .delete()
            .eq('house_id', houseId)
            .eq('name_key', key)
            .select('storage_path');
          if (error) throw error;
          // Use the path the DB actually deleted so cleanup targets the right
          // file even if another client replaced the entry since our last load.
          const deletedPath =
            (deletedRows as Array<{ storage_path: string }> | null)?.[0]?.storage_path ?? old.path;
          // Update cache and overlay immediately before the async cleanup check,
          // but only when still in the same household so a stale completion
          // cannot overwrite a different household's cache.
          if (houseId === loadHouseId) {
            const rest = Object.assign(
              Object.create(null) as Record<string, ProductPhoto>,
              get().photos
            );
            delete rest[key];
            set({ photos: rest });
            mutationOverlay[key] = null;
          }
          const stillReferenced = await isPathReferencedInDb(deletedPath);
          if (!stillReferenced) removeObject(deletedPath);
        } catch (err) {
          captureError(err, { context: 'grocery-photo-remove', houseId });
          throw new Error('Could not remove the photo. Please try again.');
        }
      },

      carryPhoto: async ({ houseId, fromName, toName, userId }): Promise<void> => {
        const from = productPhotoKey(fromName);
        const to = productPhotoKey(toName);
        const photo = get().photos[from];
        if (
          !photo ||
          !to ||
          from === to ||
          get().photos[to] ||
          [...to].length > NAME_KEY_MAX_LENGTH
        )
          return;
        try {
          const { error } = await supabase.from('grocery_product_photos').insert({
            house_id: houseId,
            name_key: to,
            storage_path: photo.path,
            added_by: userId,
          });
          if (error) throw error;
          // Only update cache/overlay when the active household has not changed,
          // so a stale carry cannot publish another household's photo.
          if (houseId === loadHouseId) {
            const updatedPhotos = Object.assign(
              Object.create(null) as Record<string, ProductPhoto>,
              get().photos
            );
            updatedPhotos[to] = photo;
            set({ photos: updatedPhotos });
            mutationOverlay[to] = photo;
          }
        } catch (err) {
          captureError(err, { context: 'grocery-photo-carry', houseId });
        }
      },

      clearError: (): void => set({ error: null }),
    }),
    { name: 'grocery-photo-store' }
  )
);
