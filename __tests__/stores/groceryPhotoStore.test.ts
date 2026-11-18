import { useGroceryPhotoStore, productPhotoKey } from '../../stores/groceryPhotoStore';
import { ok, fail, dbResult } from '../__helpers__/supabaseMock';

const mockFrom = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockSign = jest.fn();
const mockSignMany = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    storage: {
      from: (): unknown => ({
        upload: (...a: unknown[]): unknown => mockUpload(...a),
        remove: (...a: unknown[]): unknown => mockRemove(...a),
        createSignedUrl: (...a: unknown[]): unknown => mockSign(...a),
        createSignedUrls: (...a: unknown[]): unknown => mockSignMany(...a),
      }),
    },
  },
}));

jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({ uri: 'file://small.jpg' })),
  SaveFormat: { JPEG: 'jpeg' },
}));

const HOUSE = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  useGroceryPhotoStore.setState({ photos: {}, isLoading: false, error: null });
  global.fetch = jest.fn(async () => ({
    blob: async (): Promise<Blob> => new Blob(['x']),
  })) as never;
  mockRemove.mockResolvedValue({ error: null });
});

describe('productPhotoKey', () => {
  it('matches names regardless of case and extra spaces', () => {
    expect(productPhotoKey('  Oat   Milk ')).toBe('oat milk');
    expect(productPhotoKey('חלב')).toBe('חלב');
  });
});

describe('load', () => {
  it('signs every saved photo and keys it by name', async () => {
    mockFrom.mockReturnValue(ok([{ name_key: 'milk', storage_path: `${HOUSE}/1_grocery_a.jpg` }]));
    mockSignMany.mockResolvedValue({ data: [{ signedUrl: 'https://signed/milk' }], error: null });

    await useGroceryPhotoStore.getState().load(HOUSE);

    expect(useGroceryPhotoStore.getState().photos.milk.url).toBe('https://signed/milk');
  });

  it('shows an error instead of crashing when loading fails', async () => {
    mockFrom.mockReturnValue(fail('boom'));
    await useGroceryPhotoStore.getState().load(HOUSE);
    expect(useGroceryPhotoStore.getState().error).toBe('Could not load product photos.');
  });
});

describe('setPhoto', () => {
  it('uploads into the house folder and remembers it for the name', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(ok(null));
    mockSign.mockResolvedValue({ data: { signedUrl: 'https://signed/new' }, error: null });

    await useGroceryPhotoStore
      .getState()
      .setPhoto({ houseId: HOUSE, name: 'Milk ', localUri: 'file://big.jpg', userId: 'u1' });

    const path = mockUpload.mock.calls[0][0] as string;
    // Must match the house-photos storage policy: "<house>/<13+ digits>_<name>".
    expect(path).toMatch(new RegExp(`^${HOUSE}/[0-9]{13,}_.+$`));
    expect(useGroceryPhotoStore.getState().photos.milk.url).toBe('https://signed/new');
  });

  it('deletes the old file when a photo is replaced', async () => {
    useGroceryPhotoStore.setState({
      photos: { milk: { path: `${HOUSE}/1_grocery_old.jpg`, url: 'old' } },
    });
    mockUpload.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(ok(null));
    mockSign.mockResolvedValue({ data: { signedUrl: 'https://signed/new' }, error: null });

    await useGroceryPhotoStore
      .getState()
      .setPhoto({ houseId: HOUSE, name: 'milk', localUri: 'file://big.jpg', userId: 'u1' });

    expect(mockRemove).toHaveBeenCalledWith([`${HOUSE}/1_grocery_old.jpg`]);
  });

  it('cleans up the uploaded file and keeps the old photo when saving the row fails', async () => {
    useGroceryPhotoStore.setState({ photos: { milk: { path: 'old-path', url: 'old' } } });
    mockUpload.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(fail('denied'));

    await expect(
      useGroceryPhotoStore
        .getState()
        .setPhoto({ houseId: HOUSE, name: 'milk', localUri: 'file://big.jpg', userId: 'u1' })
    ).rejects.toThrow('Could not save the photo');

    expect(mockRemove).toHaveBeenCalledWith([mockUpload.mock.calls[0][0]]);
    expect(useGroceryPhotoStore.getState().photos.milk.url).toBe('old');
  });
});

describe('removePhoto', () => {
  it('forgets the photo and deletes its file', async () => {
    useGroceryPhotoStore.setState({ photos: { milk: { path: 'p', url: 'u' } } });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryPhotoStore.getState().removePhoto(HOUSE, 'Milk');

    expect(useGroceryPhotoStore.getState().photos.milk).toBeUndefined();
    expect(mockRemove).toHaveBeenCalledWith(['p']);
  });

  it('keeps the photo when the delete fails', async () => {
    useGroceryPhotoStore.setState({ photos: { milk: { path: 'p', url: 'u' } } });
    mockFrom.mockReturnValue(fail('denied'));

    await expect(useGroceryPhotoStore.getState().removePhoto(HOUSE, 'milk')).rejects.toThrow();
    expect(useGroceryPhotoStore.getState().photos.milk).toBeDefined();
  });
});

describe('carryPhoto', () => {
  it('gives a renamed item the same photo', async () => {
    useGroceryPhotoStore.setState({ photos: { milk: { path: 'p', url: 'u' } } });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryPhotoStore
      .getState()
      .carryPhoto({ houseId: HOUSE, fromName: 'Milk', toName: 'Oat milk', userId: 'u1' });

    expect(useGroceryPhotoStore.getState().photos['oat milk']).toEqual({ path: 'p', url: 'u' });
    expect(useGroceryPhotoStore.getState().photos.milk).toBeDefined();
  });

  it('leaves a photo the new name already has', async () => {
    useGroceryPhotoStore.setState({
      photos: { milk: { path: 'p', url: 'u' }, 'oat milk': { path: 'q', url: 'v' } },
    });

    await useGroceryPhotoStore
      .getState()
      .carryPhoto({ houseId: HOUSE, fromName: 'milk', toName: 'oat milk', userId: 'u1' });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(useGroceryPhotoStore.getState().photos['oat milk'].path).toBe('q');
  });

  it('does not throw when saving fails', async () => {
    useGroceryPhotoStore.setState({ photos: { milk: { path: 'p', url: 'u' } } });
    mockFrom.mockReturnValue(fail('denied'));

    await expect(
      useGroceryPhotoStore
        .getState()
        .carryPhoto({ houseId: HOUSE, fromName: 'milk', toName: 'oat milk', userId: 'u1' })
    ).resolves.toBeUndefined();
  });

  it('keeps the shared file when another name still references its path in the database', async () => {
    // Initialize loadHouseId so removePhoto's cache update is not skipped.
    mockFrom.mockReturnValueOnce(ok([]));
    await useGroceryPhotoStore.getState().load(HOUSE);

    // Only milk is in the local cache; the other reference to path 'p' lives in
    // the DB only, so a cache-only check would wrongly conclude the file is unused.
    useGroceryPhotoStore.setState({
      photos: {
        milk: { path: 'p', url: 'u' },
        butter: { path: 'r', url: 'w' },
      },
    });
    // 1st call: delete returns the removed row's path; 2nd: reference check returns count=1.
    mockFrom
      .mockReturnValueOnce(ok([{ storage_path: 'p' }]))
      .mockReturnValueOnce(dbResult({ data: null, error: null, count: 1 } as never));

    await useGroceryPhotoStore.getState().removePhoto(HOUSE, 'milk');

    expect(mockRemove).not.toHaveBeenCalled();
    expect(useGroceryPhotoStore.getState().photos.milk).toBeUndefined();
    expect(useGroceryPhotoStore.getState().photos.butter).toEqual({ path: 'r', url: 'w' });
  });
});
