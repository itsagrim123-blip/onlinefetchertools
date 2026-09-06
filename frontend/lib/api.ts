export type VideoFormat = {
  format_id: string;
  language?: string | null;
  resolution?: string | null;
  ext: string;
  filesize?: number | null;
  type: "video" | "audio";
  quality_label?: string | null;
  has_video?: boolean;
  has_audio?: boolean;
};

export type VideoMetadata = {
  success: boolean;
  id: string;
  title: string;
  thumbnail?: string | null;
  duration?: number | null;
  uploader?: string | null;
  formats: VideoFormat[];
};

export type DownloadRequest = {
  url: string;
  format_id: string;
  filename_preference?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type DownloadJob = {
  id: string;
  url: string;
  format_id: string;
  status: "queued" | "downloading" | "processing" | "complete" | "failed";
  progress: number;
  filename?: string | null;
  created_at: string;
  completed_at?: string | null;
  error?: string | null;
  temp_dir?: string | null;
  downloaded_size?: string | null;
  speed?: string | null;
  eta?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type DownloadStatus = {
  job_id: string;
  status: "queued" | "downloading" | "processing" | "complete" | "failed";
  progress: number;
  filename?: string | null;
  error?: string | null;
  downloaded_size?: string | null;
  speed?: string | null;
  eta?: string | null;
};

export type ApiError = {
  detail?: string | Array<{ msg?: string }>;
};

export type BackendHealthResponse = {
  status?: string;
  service?: string;
  dependencies?: Record<string, boolean>;
  [key: string]: unknown;
};

export type HealthCheckResult = {
  isOnline: boolean;
  status: "online" | "offline";
  data?: BackendHealthResponse;
  error?: string;
};

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) return "";
  return url.trim().replace(/\/$/, "");
}

export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Online Fetcher Tools API URL is not configured. Set NEXT_PUBLIC_API_URL.");
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

export async function checkBackendHealth(timeoutMs: number = 8000): Promise<HealthCheckResult> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return {
      isOnline: false,
      status: "offline",
      error: "Backend API URL is not configured (NEXT_PUBLIC_API_URL is missing).",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        isOnline: false,
        status: "offline",
        error: `Server responded with status ${response.status}`,
      };
    }

    const data = (await response.json()) as BackendHealthResponse;
    if (typeof data !== "object" || data === null) {
      return {
        isOnline: false,
        status: "offline",
        error: "Invalid JSON response from health endpoint.",
      };
    }

    return {
      isOnline: true,
      status: "online",
      data,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    return {
      isOnline: false,
      status: "offline",
      error: isTimeout ? "Health check timed out." : "Unable to reach backend server.",
    };
  }
}

function getApiErrorMessage(errorBody: ApiError): string {
  if (typeof errorBody.detail === "string") return errorBody.detail;
  if (Array.isArray(errorBody.detail)) {
    return errorBody.detail.map((error) => error.msg).filter(Boolean).join(", ") || "Request failed";
  }
  return "Request failed";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const apiUrl = getApiUrl(path);
  let response: Response;
  try {
    response = await fetch(apiUrl, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Unable to reach the Online Fetcher Tools backend. Check the API URL and backend status.");
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ detail: "Request failed" }))) as ApiError;
    throw new Error(getApiErrorMessage(errorBody));
  }

  return response.json() as Promise<T>;
}

export async function analyzeUrl(url: string): Promise<VideoMetadata> {
  return api<VideoMetadata>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function createDownload(
  url: string,
  formatId: string,
  filenamePreference?: string,
  startTime?: string,
  endTime?: string
): Promise<{ job_id: string; status: string }> {
  return api<{ job_id: string; status: string }>("/api/download", {
    method: "POST",
    body: JSON.stringify({
      url,
      format_id: formatId,
      filename_preference: filenamePreference ?? null,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
    }),
  });
}

export async function getDownloadStatus(jobId: string): Promise<DownloadStatus> {
  return api<DownloadStatus>(`/api/download/${jobId}/status`);
}

export function getDownloadFileUrl(jobId: string): string {
  return getApiUrl(`/api/download/${jobId}/file`);
}

const toolEndpoints: Record<string, string> = {
  "video-editor": "/api/media/edit",
  "video-to-gif": "/api/media/video-to-gif",
  "image-compressor": "/api/image/compress",
  "image-resizer": "/api/image/resize",
  "image-cropper": "/api/image/crop",
  "image-rotator": "/api/image/rotate",
  "jpg-to-png": "/api/image/convert",
  "png-to-jpg": "/api/image/convert",
  "webp-to-jpg": "/api/image/convert",
  "webp-to-png": "/api/image/convert",
  "jpg-to-webp": "/api/image/convert",
  "png-to-webp": "/api/image/convert",
  "heic-to-jpg": "/api/image/convert",
  "image-to-pdf": "/api/pdf/from-images",
  "pdf-merge": "/api/pdf/merge",
  "pdf-split": "/api/pdf/split",
  "pdf-compressor": "/api/pdf/compress",
  "pdf-to-images": "/api/pdf/to-images",
  "pdf-delete-pages": "/api/pdf/delete-pages",
  "pdf-reorder": "/api/pdf/reorder",
  "pdf-page-manager": "/api/pdf/manage",
  "pdf-to-text": "/api/pdf/to-text",
  "media-converter": "/api/media/convert",
  "audio-extractor": "/api/media/extract-audio",
  "zip-creator": "/api/file/create-zip",
  "zip-extractor": "/api/file/extract-zip",
  "background-remover": "/api/image/remove-background",
};

import { normalizeBlob, parseFilename, resolveMimeType } from "./download";

export type RemoveBackgroundOptions = {
  edgeRefinement?: boolean;
  backgroundColor?: string;
};

export async function removeImageBackground(
  file: File,
  options?: RemoveBackgroundOptions
): Promise<{ blob: Blob; filename: string; width?: number; height?: number }> {
  const form = new FormData();
  form.append("file", file);
  if (options?.edgeRefinement) {
    form.append("edge_refinement", "true");
  }
  if (options?.backgroundColor && options.backgroundColor !== "transparent") {
    form.append("background_color", options.backgroundColor);
  }

  const stem = file.name.replace(/\.[^/.]+$/, "");
  const fallbackFilename = `${stem}-no-bg.png`;

  let response: Response;
  try {
    response = await fetch(getApiUrl("/api/image/remove-background"), {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error("Unable to reach the Online Fetcher Tools backend. Please check your connection or server status.");
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ detail: "Background removal failed" }))) as ApiError;
    throw new Error(getApiErrorMessage(errorBody));
  }

  const contentType = response.headers.get("content-type");
  const filename = parseFilename(response.headers, fallbackFilename);
  const rawBlob = await response.blob();
  const mimeType = resolveMimeType(contentType, filename, "image/png");
  const blob = normalizeBlob(rawBlob, mimeType);

  const wHeader = response.headers.get("x-image-width");
  const hHeader = response.headers.get("x-image-height");
  const width = wHeader ? parseInt(wHeader, 10) : undefined;
  const height = hHeader ? parseInt(hHeader, 10) : undefined;

  return { blob, filename, width, height };
}


export async function runFileTool(
  slug: string,
  body: FormData,
  fallbackFilename?: string
): Promise<{ blob: Blob; filename: string }> {
  const endpoint = toolEndpoints[slug];
  if (!endpoint) throw new Error("This tool is not available.");
  let response: Response;
  try {
    response = await fetch(getApiUrl(endpoint), { method: "POST", body });
  } catch {
    throw new Error("Unable to reach the Online Fetcher Tools backend.");
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ detail: "Processing failed" }))) as ApiError;
    throw new Error(getApiErrorMessage(errorBody));
  }
  const contentType = response.headers.get("content-type");
  const filename = parseFilename(response.headers, fallbackFilename || "download");
  const rawBlob = await response.blob();
  const mimeType = resolveMimeType(contentType, filename, rawBlob.type);
  const blob = normalizeBlob(rawBlob, mimeType);
  return { blob, filename };
}

export type PdfThumbnailsResponse = {
  page_count: number;
  thumbnails: string[];
};

export async function fetchPdfThumbnails(file: File): Promise<PdfThumbnailsResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(getApiUrl("/api/pdf/thumbnails"), {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ detail: "Failed to generate page thumbnails" }))) as ApiError;
    throw new Error(getApiErrorMessage(errorBody));
  }
  return response.json() as Promise<PdfThumbnailsResponse>;
}

export type ZipEntry = {
  name: string;
  size: number;
  compressed_size: number;
  is_dir: boolean;
};

export type ZipInspectResponse = {
  file_count: number;
  entries: ZipEntry[];
};

export async function inspectZipArchive(file: File): Promise<ZipInspectResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(getApiUrl("/api/file/inspect-zip"), {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ detail: "Failed to inspect ZIP archive" }))) as ApiError;
    throw new Error(getApiErrorMessage(errorBody));
  }
  return response.json() as Promise<ZipInspectResponse>;
}

