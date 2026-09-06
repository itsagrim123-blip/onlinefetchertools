import { MediaType } from "../types";

export interface ProbedMedia {
  duration: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  type: MediaType;
}

export function detectMediaType(file: File): MediaType {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";

  // Fallback by extension
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "webm", "mov", "mkv", "avi", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext)) return "image";

  return "video";
}

export async function probeMediaFile(file: File): Promise<ProbedMedia> {
  const mediaType = detectMediaType(file);
  const objectUrl = URL.createObjectURL(file);

  try {
    if (mediaType === "video") {
      return await new Promise<ProbedMedia>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = objectUrl;
        video.muted = true;
        video.playsInline = true;

        let resolved = false;

        const cleanup = () => {
          video.remove();
          URL.revokeObjectURL(objectUrl);
        };

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ duration: 5.0, type: "video" });
          }
        }, 5000);

        video.onloadedmetadata = () => {
          const duration = video.duration && !isNaN(video.duration) ? video.duration : 5.0;
          const width = video.videoWidth || 1920;
          const height = video.videoHeight || 1080;

          // Seek to 0.5s or 10% to generate thumbnail
          video.currentTime = Math.min(0.5, duration / 2);
        };

        video.onseeked = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);

          let thumbnailUrl: string | undefined;
          try {
            const canvas = document.createElement("canvas");
            const w = Math.min(video.videoWidth || 320, 320);
            const h = Math.round((video.videoHeight || 180) * (w / (video.videoWidth || 320)));
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7);
            }
          } catch {
            // Thumbnail extraction failed (e.g. tainted canvas)
          }

          const duration = video.duration && !isNaN(video.duration) ? video.duration : 5.0;
          const width = video.videoWidth || 1920;
          const height = video.videoHeight || 1080;

          cleanup();
          resolve({
            duration,
            width,
            height,
            thumbnailUrl,
            type: "video",
          });
        };

        video.onerror = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            resolve({ duration: 5.0, type: "video" });
          }
        };
      });
    }

    if (mediaType === "audio") {
      return await new Promise<ProbedMedia>((resolve) => {
        const audio = document.createElement("audio");
        audio.preload = "metadata";
        audio.src = objectUrl;

        let resolved = false;
        const cleanup = () => {
          audio.remove();
          URL.revokeObjectURL(objectUrl);
        };

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ duration: 10.0, type: "audio" });
          }
        }, 5000);

        audio.onloadedmetadata = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            const duration = audio.duration && !isNaN(audio.duration) ? audio.duration : 10.0;
            cleanup();
            resolve({ duration, type: "audio" });
          }
        };

        audio.onerror = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            resolve({ duration: 10.0, type: "audio" });
          }
        };
      });
    }

    if (mediaType === "image") {
      return await new Promise<ProbedMedia>((resolve) => {
        const img = new Image();
        img.src = objectUrl;

        img.onload = () => {
          const width = img.naturalWidth || 1920;
          const height = img.naturalHeight || 1080;
          URL.revokeObjectURL(objectUrl);
          resolve({
            duration: 3.0, // standard still duration
            width,
            height,
            thumbnailUrl: img.src,
            type: "image",
          });
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({ duration: 3.0, type: "image" });
        };
      });
    }

    return { duration: 5.0, type: "video" };
  } catch {
    return { duration: 5.0, type: mediaType };
  }
}

export function captureVideoFrame(
  videoElement: HTMLVideoElement,
  format: "jpg" | "png" = "jpg"
): { blob: Blob; dataUrl: string } | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth || 1920;
    canvas.height = videoElement.videoHeight || 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.95);

    // Convert dataURL to Blob
    const arr = dataUrl.split(",");
    const byteString = atob(arr[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mime });

    return { blob, dataUrl };
  } catch (err) {
    console.error("Frame capture failed:", err);
    return null;
  }
}

export async function extractFilmstripFrames(
  file: File,
  frameCount: number = 6
): Promise<string[]> {
  if (!file.type.startsWith("video/")) return [];
  const objectUrl = URL.createObjectURL(file);

  return new Promise<string[]>((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;

    const frames: string[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 54;
    const ctx = canvas.getContext("2d");

    let resolved = false;
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        video.remove();
        URL.revokeObjectURL(objectUrl);
        resolve(frames);
      }
    };

    const timeout = setTimeout(cleanup, 6000);

    video.onloadedmetadata = () => {
      const dur = video.duration && !isNaN(video.duration) ? video.duration : 5;
      const step = dur / (frameCount + 1);
      let currentIdx = 1;

      const seekNext = () => {
        if (currentIdx <= frameCount) {
          video.currentTime = currentIdx * step;
        } else {
          clearTimeout(timeout);
          cleanup();
        }
      };

      video.onseeked = () => {
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.6));
          } catch {
            // Ignore capture error
          }
        }
        currentIdx++;
        seekNext();
      };

      seekNext();
    };

    video.onerror = cleanup;
  });
}


