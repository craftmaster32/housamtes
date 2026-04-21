import React from 'react';

interface PhotoPickerProps {
  photos: string[]; // full data URLs
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

// Resize + compress a File to a JPEG data URL (~100-200 KB each).
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const MAX_PX = 1200;
    const QUALITY = 0.75;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = (): void => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

export function PhotoPicker({ photos, onChange, maxPhotos = 6 }: PhotoPickerProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(false);

  const handleFiles = React.useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const slots = maxPhotos - photos.length;
      const compressed = await Promise.all(
        Array.from(files).slice(0, slots).map(compressImage)
      );
      onChange([...photos, ...compressed]);
    } catch {
      // silently ignore compression errors
    } finally {
      setLoading(false);
      // reset so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [photos, onChange, maxPhotos]);

  const removePhoto = React.useCallback((idx: number) => {
    onChange(photos.filter((_, i) => i !== idx));
  }, [photos, onChange]);

  const openFull = React.useCallback((src: string) => {
    window.open(src, '_blank');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Thumbnails */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
              <img
                src={src}
                onClick={() => openFull(src)}
                style={{
                  width: 80, height: 80,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  display: 'block',
                }}
              />
              <button
                onClick={() => removePhoto(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: '#ef4444', border: 'none',
                  color: 'white', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {photos.length < maxPhotos && (
        <div
          onClick={() => !loading && inputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: '2px dashed #e5e7eb',
            borderRadius: 10,
            cursor: loading ? 'default' : 'pointer',
            color: loading ? '#9ca3af' : '#6366f1',
            fontWeight: '600',
            fontSize: 14,
            backgroundColor: 'white',
            userSelect: 'none',
            width: 'fit-content',
          }}
        >
          {loading ? '⏳ Processing…' : '📷 Add photos'}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
