import {
  getFileExtension,
  sanitizeFilename,
  parseFilename,
  resolveMimeType,
  normalizeBlob,
} from '@/lib/download';

describe('download utilities', () => {
  describe('getFileExtension', () => {
    it('returns lowercase extension including the dot', () => {
      expect(getFileExtension('photo.JPG')).toBe('.jpg');
      expect(getFileExtension('archive.tar.gz')).toBe('.gz');
      expect(getFileExtension('document.PDF')).toBe('.pdf');
    });

    it('returns empty string when no extension exists', () => {
      expect(getFileExtension('download')).toBe('');
      expect(getFileExtension('file.')).toBe('');
      expect(getFileExtension('.gitignore')).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('strips paths and unsafe characters', () => {
      expect(sanitizeFilename('C:\\path\\to\\file.png')).toBe('file.png');
      expect(sanitizeFilename('../../secret.pdf')).toBe('secret.pdf');
      expect(sanitizeFilename('my"file\';.jpg')).toBe('myfile.jpg');
    });
  });

  describe('parseFilename', () => {
    it('prefers X-Filename header when present', () => {
      const headers = new Headers({
        'x-filename': encodeURIComponent('family_photo.jpg'),
        'content-disposition': 'attachment; filename="other.png"',
      });
      expect(parseFilename(headers, 'fallback', '.jpg')).toBe('family_photo.jpg');
    });

    it('decodes RFC 5987 filename*=UTF-8 format correctly', () => {
      const headers = new Headers({
        'content-disposition': "attachment; filename*=UTF-8''vacation%20sunset.webp",
      });
      expect(parseFilename(headers, 'fallback', '.webp')).toBe('vacation sunset.webp');
    });

    it('parses standard quoted filename from Content-Disposition', () => {
      const headers = new Headers({
        'content-disposition': 'attachment; filename="document_final.pdf"',
      });
      expect(parseFilename(headers, 'fallback', '.pdf')).toBe('document_final.pdf');
    });

    it('falls back with extension if filename in header is generic "download" without extension', () => {
      const headers = new Headers({
        'content-disposition': 'attachment; filename="download"',
      });
      expect(parseFilename(headers, 'my_photo', '.jpg')).toBe('my_photo.jpg');
    });

    it('falls back safely when headers are empty', () => {
      const headers = new Headers({});
      expect(parseFilename(headers, 'export_result', '.png')).toBe('export_result.png');
    });
  });

  describe('resolveMimeType', () => {
    it('uses specific Content-Type header if available', () => {
      expect(resolveMimeType('image/png; charset=utf-8', 'file.png')).toBe('image/png');
      expect(resolveMimeType('application/pdf', 'file.bin')).toBe('application/pdf');
    });

    it('resolves correct MIME type from filename extension if header is generic octet-stream', () => {
      expect(resolveMimeType('application/octet-stream', 'photo.jpg')).toBe('image/jpeg');
      expect(resolveMimeType('application/octet-stream', 'photo.jpeg')).toBe('image/jpeg');
      expect(resolveMimeType('application/octet-stream', 'image.png')).toBe('image/png');
      expect(resolveMimeType('application/octet-stream', 'image.webp')).toBe('image/webp');
      expect(resolveMimeType('application/octet-stream', 'animation.gif')).toBe('image/gif');
      expect(resolveMimeType('application/octet-stream', 'video.mp4')).toBe('video/mp4');
      expect(resolveMimeType('application/octet-stream', 'song.mp3')).toBe('audio/mpeg');
      expect(resolveMimeType('application/octet-stream', 'report.pdf')).toBe('application/pdf');
      expect(resolveMimeType('application/octet-stream', 'files.zip')).toBe('application/zip');
      expect(resolveMimeType('application/octet-stream', 'notes.txt')).toBe('text/plain');
    });

    it('resolves correct MIME type from filename extension if header is missing', () => {
      expect(resolveMimeType(null, 'photo.jpg')).toBe('image/jpeg');
      expect(resolveMimeType(undefined, 'movie.mp4')).toBe('video/mp4');
    });
  });

  describe('normalizeBlob', () => {
    it('returns identical blob if MIME type already matches', () => {
      const blob = new Blob(['sample data'], { type: 'image/png' });
      const normalized = normalizeBlob(blob, 'image/png');
      expect(normalized.type).toBe('image/png');
    });

    it('creates a new typed Blob if existing blob was application/octet-stream', () => {
      const blob = new Blob(['image data'], { type: 'application/octet-stream' });
      const normalized = normalizeBlob(blob, 'image/jpeg');
      expect(normalized.type).toBe('image/jpeg');
      expect(normalized.size).toBe(blob.size);
    });
  });

  describe('sequential downloads pipeline', () => {
    it('correctly isolates and handles rapid sequential downloads of varying types', () => {
      const filesToProcess = [
        { headerName: 'photo.jpg', contentType: 'image/jpeg', expectedMime: 'image/jpeg' },
        { headerName: 'graphic.png', contentType: 'image/png', expectedMime: 'image/png' },
        { headerName: 'document.pdf', contentType: 'application/pdf', expectedMime: 'application/pdf' },
        { headerName: 'sunset.webp', contentType: 'image/webp', expectedMime: 'image/webp' },
        { headerName: 'clip.mp4', contentType: 'video/mp4', expectedMime: 'video/mp4' },
      ];

      for (const item of filesToProcess) {
        const headers = new Headers({
          'x-filename': encodeURIComponent(item.headerName),
          'content-type': item.contentType,
        });

        const parsedName = parseFilename(headers, 'fallback', '.bin');
        expect(parsedName).toBe(item.headerName);

        const mime = resolveMimeType(headers.get('content-type'), parsedName);
        expect(mime).toBe(item.expectedMime);

        const rawBlob = new Blob(['test content'], { type: 'application/octet-stream' });
        const normalized = normalizeBlob(rawBlob, mime);
        expect(normalized.type).toBe(item.expectedMime);
      }
    });
  });
});
