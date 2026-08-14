/**
 * QA — photoStore
 *
 * The house-photos bucket is private: load() must convert each stored
 * canonical URL into a short-lived signed URL for display, and expose the
 * raw object path (storagePath) so deletes target the right file.
 */

import {
  usePhotoStore,
  storagePathFromUrl,
  signHousePhotoUrl,
  __resetSignedUrlCache,
} from '@stores/photoStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockCreateSignedUrls = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    storage: {
      from: (): unknown => ({
        createSignedUrls: (...a: unknown[]): unknown => mockCreateSignedUrls(...a),
        createSignedUrl: (...a: unknown[]): unknown => mockCreateSignedUrl(...a),
        upload: (...a: unknown[]): unknown => mockUpload(...a),
        getPublicUrl: (...a: unknown[]): unknown => mockGetPublicUrl(...a),
      }),
    },
    channel: (): unknown => {
      const chain = { on: (): unknown => chain, subscribe: (): unknown => chain };
      return chain;
    },
    removeChannel: jest.fn(),
  },
}));

jest.mock('@stores/authStore', () => ({
  useAuthStore: { getState: (): { houseId: string } => ({ houseId: 'house-1' }) },
}));

jest.mock('@lib/errorTracking', () => ({
  captureError: jest.fn(),
}));

const BASE = 'https://x.supabase.co/storage/v1/object/public/house-photos';

const row = (id: string, path: string): Record<string, unknown> => ({
  id,
  url: `${BASE}/${path}`,
  caption: null,
  category: 'general',
  uploaded_by: 'Alice',
  user_id: 'user-1',
  created_at: '2026-07-01T00:00:00Z',
});

beforeEach(() => {
  usePhotoStore.setState({ photos: [], isLoading: true });
  __resetSignedUrlCache();
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// storagePathFromUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('storagePathFromUrl', () => {
  it('extracts the object path from a canonical bucket URL', () => {
    expect(storagePathFromUrl(`${BASE}/house-1/123_photo.jpg`)).toBe('house-1/123_photo.jpg');
  });

  it('decodes URL-encoded file names', () => {
    expect(storagePathFromUrl(`${BASE}/house-1/123_my%20photo.jpg`)).toBe(
      'house-1/123_my photo.jpg'
    );
  });

  it('strips query strings (signed URLs)', () => {
    expect(storagePathFromUrl(`${BASE}/house-1/123_a.jpg?token=abc`)).toBe('house-1/123_a.jpg');
  });

  it('returns null for URLs outside the bucket', () => {
    expect(storagePathFromUrl('https://example.com/other/file.jpg')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// load
// ─────────────────────────────────────────────────────────────────────────────

describe('photoStore — load', () => {
  it('replaces stored URLs with signed URLs and sets storagePath', async () => {
    mockFrom.mockReturnValue(ok([row('p1', 'house-1/111_a.jpg'), row('p2', 'house-1/222_b.jpg')]));
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        { path: 'house-1/111_a.jpg', signedUrl: 'https://signed/a', error: null },
        { path: 'house-1/222_b.jpg', signedUrl: 'https://signed/b', error: null },
      ],
      error: null,
    });

    await usePhotoStore.getState().load('house-1');

    const photos = usePhotoStore.getState().photos;
    expect(photos).toHaveLength(2);
    expect(photos[0].url).toBe('https://signed/a');
    expect(photos[0].storagePath).toBe('house-1/111_a.jpg');
    expect(photos[1].url).toBe('https://signed/b');
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(
      ['house-1/111_a.jpg', 'house-1/222_b.jpg'],
      expect.any(Number)
    );
  });

  it('falls back to the stored URL when signing fails', async () => {
    mockFrom.mockReturnValue(ok([row('p1', 'house-1/111_a.jpg')]));
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: { message: 'sign failed' } });

    await usePhotoStore.getState().load('house-1');

    const photos = usePhotoStore.getState().photos;
    expect(photos[0].url).toBe(`${BASE}/house-1/111_a.jpg`);
    expect(photos[0].storagePath).toBe('house-1/111_a.jpg');
    expect(usePhotoStore.getState().isLoading).toBe(false);
  });

  it('reuses cached signed URLs on a second load instead of re-signing', async () => {
    mockFrom.mockReturnValue(ok([row('p1', 'house-1/111_a.jpg'), row('p2', 'house-1/222_b.jpg')]));
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        { path: 'house-1/111_a.jpg', signedUrl: 'https://signed/a', error: null },
        { path: 'house-1/222_b.jpg', signedUrl: 'https://signed/b', error: null },
      ],
      error: null,
    });

    await usePhotoStore.getState().load('house-1');
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);

    // Same photos come back on the next load — nothing new to sign.
    await usePhotoStore.getState().load('house-1');
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(usePhotoStore.getState().photos[0].url).toBe('https://signed/a');
    expect(usePhotoStore.getState().photos[1].url).toBe('https://signed/b');
  });

  it('signs only the newly added path when the rest are cached', async () => {
    mockFrom.mockReturnValueOnce(ok([row('p1', 'house-1/111_a.jpg')]));
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [{ path: 'house-1/111_a.jpg', signedUrl: 'https://signed/a', error: null }],
      error: null,
    });
    await usePhotoStore.getState().load('house-1');

    // A new photo is added; only its path should be signed on the next load.
    mockFrom.mockReturnValueOnce(
      ok([row('p2', 'house-1/222_b.jpg'), row('p1', 'house-1/111_a.jpg')])
    );
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [{ path: 'house-1/222_b.jpg', signedUrl: 'https://signed/b', error: null }],
      error: null,
    });
    await usePhotoStore.getState().load('house-1');

    expect(mockCreateSignedUrls).toHaveBeenLastCalledWith(
      ['house-1/222_b.jpg'],
      expect.any(Number)
    );
    const photos = usePhotoStore.getState().photos;
    expect(photos.find((p) => p.id === 'p1')?.url).toBe('https://signed/a');
    expect(photos.find((p) => p.id === 'p2')?.url).toBe('https://signed/b');
  });

  it('keeps loading state consistent on DB error', async () => {
    mockFrom.mockReturnValue(fail('connection lost'));

    await usePhotoStore.getState().load('house-1');

    expect(usePhotoStore.getState().isLoading).toBe(false);
    expect(usePhotoStore.getState().photos).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signHousePhotoUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('signHousePhotoUrl', () => {
  it('signs a canonical bucket URL and caches it for reuse', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/r' }, error: null });

    const url = await signHousePhotoUrl(`${BASE}/house-1/r.jpg`);
    expect(url).toBe('https://signed/r');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('house-1/r.jpg', expect.any(Number));

    // Second call for the same object is served from cache — no re-sign.
    const again = await signHousePhotoUrl(`${BASE}/house-1/r.jpg`);
    expect(again).toBe('https://signed/r');
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('returns null for a URL outside the bucket without hitting storage', async () => {
    const url = await signHousePhotoUrl('https://example.com/other.jpg');
    expect(url).toBeNull();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('returns null when signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'nope' } });
    const url = await signHousePhotoUrl(`${BASE}/house-1/x.jpg`);
    expect(url).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// uploadReceipt
// ─────────────────────────────────────────────────────────────────────────────

describe('photoStore — uploadReceipt', () => {
  const params = {
    localUri: 'file:///tmp/receipt.jpg',
    fileName: 'receipt.jpg',
    mimeType: 'image/jpeg',
    caption: 'Groceries',
    uploadedBy: 'Alice',
    userId: 'user-1',
    houseId: 'house-1',
  };

  beforeEach(() => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      blob: (): Promise<{ size: number }> => Promise.resolve({ size: 1024 }),
    });
  });

  it('uploads, files it under receipts, and returns the canonical URL', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: `${BASE}/house-1/999_receipt.jpg` } });
    const insertSpy = jest.fn(() => ok(null));
    mockFrom.mockReturnValue({ insert: insertSpy });

    const url = await usePhotoStore.getState().uploadReceipt(params);

    expect(url).toBe(`${BASE}/house-1/999_receipt.jpg`);
    expect(mockUpload).toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'receipts', house_id: 'house-1', user_id: 'user-1' })
    );
  });

  it('throws a friendly error when the upload fails', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'bucket down' } });

    await expect(usePhotoStore.getState().uploadReceipt(params)).rejects.toThrow(
      /Could not upload the receipt/
    );
  });

  it('rejects images larger than 20 MB', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      blob: (): Promise<{ size: number }> => Promise.resolve({ size: 21 * 1024 * 1024 }),
    });

    await expect(usePhotoStore.getState().uploadReceipt(params)).rejects.toThrow(/under 20 MB/);
  });
});
