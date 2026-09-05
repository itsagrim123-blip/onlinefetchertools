export type VideoFormat = {
  format_id: string;
  resolution?: string | null;
  ext: string;
  filesize?: number | null;
  type: "video" | "audio";
  quality_label?: string | null;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

function getApiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error("ClipFetch API URL is not configured. Set NEXT_PUBLIC_API_URL.");
  }
  return `${API_BASE_URL}${path}`;
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
    throw new Error("Unable to reach the ClipFetch backend. Check the API URL and backend status.");
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

export async function createDownload(url: string, formatId: string, filenamePreference?: string): Promise<{ job_id: string; status: string }> {
  return api<{ job_id: string; status: string }>("/api/download", {
    method: "POST",
    body: JSON.stringify({ url, format_id: formatId, filename_preference: filenamePreference ?? null }),
  });
}

export async function getDownloadStatus(jobId: string): Promise<DownloadStatus> {
  return api<DownloadStatus>(`/api/download/${jobId}/status`);
}

export function getDownloadFileUrl(jobId: string): string {
  return getApiUrl(`/api/download/${jobId}/file`);
}
