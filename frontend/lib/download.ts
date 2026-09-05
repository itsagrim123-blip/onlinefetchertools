/**
 * Mobile-friendly and desktop-compatible download utilities.
 * Ensures filenames, extensions, and MIME types are properly preserved on mobile browsers (Android Chrome).
 */

export const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "application/zip": ".zip",
  "text/plain": ".txt",
};

export const EXTENSION_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heic",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".zip": "application/zip",
  ".txt": "text/plain",
};

/**
 * Extracts the file extension from a filename or path (lowercase, including the leading dot).
 */
export function getFileExtension(filename: string): string {
  const clean = filename.trim().split("?")[0].split("#")[0];
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0 || lastDot === clean.length - 1) {
    return "";
  }
  return clean.slice(lastDot).toLowerCase();
}

/**
 * Strips directory separators and dangerous characters from a filename.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/^.*[\\/]/, "")
    .replace(/["';\\]/g, "")
    .trim();
}

/**
 * Parses the intended download filename from server headers (X-Filename or Content-Disposition).
 * Falls back to a provided fallbackBase + fallbackExt if headers are missing or generic.
 */
export function parseFilename(
  headers: Headers,
  fallbackBase: string = "download",
  fallbackExt: string = ""
): string {
  // 1. Check custom X-Filename header (URL-encoded filename for full Unicode safety)
  const xFilename = headers.get("x-filename");
  if (xFilename) {
    try {
      const decoded = decodeURIComponent(xFilename.trim());
      const sanitized = sanitizeFilename(decoded);
      if (sanitized && sanitized !== "download" && getFileExtension(sanitized)) {
        return sanitized;
      }
    } catch {
      // ignore decode error and check Content-Disposition
    }
  }

  // 2. Check Content-Disposition header
  const disposition = headers.get("content-disposition");
  if (disposition) {
    // Check RFC 5987/6266 filename*=UTF-8''encoded_name
    const rfcMatch = disposition.match(/filename\*=(?:UTF-8|utf-8)''([^;\r\n]+)/i);
    if (rfcMatch && rfcMatch[1]) {
      try {
        const decoded = decodeURIComponent(rfcMatch[1].trim());
        const sanitized = sanitizeFilename(decoded);
        if (sanitized && sanitized !== "download" && getFileExtension(sanitized)) {
          return sanitized;
        }
      } catch {
        // fallback to standard filename
      }
    }

    // Check standard filename="quoted_name" or filename=unquoted_name
    const stdMatch = disposition.match(/filename="?([^";\r\n]+)"?/i);
    if (stdMatch && stdMatch[1]) {
      const sanitized = sanitizeFilename(stdMatch[1].trim());
      if (sanitized && sanitized !== "download" && getFileExtension(sanitized)) {
        return sanitized;
      }
    }
  }

  // 3. Construct clean fallback name ensuring an extension is always present
  const cleanBase = sanitizeFilename(fallbackBase).replace(/\.[^/.]+$/, "") || "download";
  const ext = fallbackExt.startsWith(".") ? fallbackExt.toLowerCase() : fallbackExt ? `.${fallbackExt.toLowerCase()}` : "";
  return `${cleanBase}${ext}`;
}

/**
 * Resolves the accurate MIME type for a downloaded file.
 * Avoids generic application/octet-stream so mobile browsers route to native viewers.
 */
export function resolveMimeType(
  contentTypeHeader: string | null | undefined,
  filename: string,
  blobType?: string
): string {
  const cleanHeader = (contentTypeHeader ?? "").split(";")[0].trim().toLowerCase();
  const cleanBlobType = (blobType ?? "").split(";")[0].trim().toLowerCase();

  // If header is specific (not octet-stream or empty), use it
  if (cleanHeader && cleanHeader !== "application/octet-stream") {
    return cleanHeader;
  }

  // Next, determine from filename extension
  const ext = getFileExtension(filename);
  if (ext && EXTENSION_MIME[ext]) {
    return EXTENSION_MIME[ext];
  }

  // If blobType is specific, use it
  if (cleanBlobType && cleanBlobType !== "application/octet-stream") {
    return cleanBlobType;
  }

  return "application/octet-stream";
}

/**
 * Ensures the Blob object has the exact required MIME type.
 * Android Chrome uses the Blob's internal type when creating object URLs.
 */
export function normalizeBlob(blob: Blob, expectedMimeType: string): Blob {
  const current = (blob.type || "").split(";")[0].trim().toLowerCase();
  const target = expectedMimeType.split(";")[0].trim().toLowerCase();

  if (current === target || !target || target === "application/octet-stream") {
    return blob;
  }

  return new Blob([blob], { type: target });
}

/**
 * Triggers a mobile-safe and desktop-safe browser download for a Blob or object URL.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const ext = getFileExtension(filename);
  const mimeType = resolveMimeType(null, filename, blob.type);
  const finalBlob = normalizeBlob(blob, mimeType);
  const url = URL.createObjectURL(finalBlob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `file${ext || ".bin"}`;
  anchor.style.display = "none";
  anchor.rel = "noopener noreferrer";

  document.body.appendChild(anchor);
  anchor.click();

  // Delay revoke to give mobile Chrome's download thread time to access the Blob
  setTimeout(() => {
    try {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // ignore cleanup errors
    }
  }, 10000);
}

