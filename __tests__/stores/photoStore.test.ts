/**
 * QA — photoStore
 *
 * The house-photos bucket is private: load() must convert each stored
 * canonical URL into a short-lived signed URL for display, and expose the
 * raw object path (storagePath) so deletes target the right file.
 */

import { usePhotoStore, storagePathFromUrl } from '../../stores/photoStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockCreateSignedUrls = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    storage: {
      from: (): unknown => ({
        createSignedUrls: (...a: unknown[]): unknown => mockCreateSignedUrls(...a),
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

  it('keeps loading state consistent on DB error', async () => {
    mockFrom.mockReturnValue(fail('connection lost'));

    await usePhotoStore.getState().load('house-1');

    expect(usePhotoStore.getState().isLoading).toBe(false);
    expect(usePhotoStore.getState().photos).toEqual([]);
  });
});
