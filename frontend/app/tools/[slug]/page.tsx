import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { FileToolWorkspace } from "@/components/tools/FileToolWorkspace";
import { VideoEditorWorkspace } from "@/components/tools/VideoEditorWorkspace";
import { PdfPageManagerWorkspace } from "@/components/tools/PdfPageManagerWorkspace";
import { PhotoEditorWorkspace } from "@/components/tools/PhotoEditorWorkspace";
import { ZipExtractorWorkspace } from "@/components/tools/ZipExtractorWorkspace";
import { DownloaderCard } from "@/components/DownloaderCard";
import { BackendStatus } from "@/components/BackendStatus";

const toolTitles: Record<string, string> = {
  youtube: "YouTube Downloader",
  "video-editor": "Video Editor",
  "video-to-gif": "Video to GIF",
  "image-compressor": "Image Compressor",
  "image-resizer": "Image Resizer",
  "image-cropper": "Image Cropper",
  "image-rotator": "Image Rotator",
  "jpg-to-png": "JPG to PNG",
  "png-to-jpg": "PNG to JPG",
  "webp-to-jpg": "WebP to JPG",
  "webp-to-png": "WebP to PNG",
  "jpg-to-webp": "JPG to WebP",
  "png-to-webp": "PNG to WebP",
  "heic-to-jpg": "HEIC to JPG",
  "image-to-pdf": "Images to PDF",
  "pdf-merge": "Merge PDF Files",
  "pdf-split": "Split PDF",
  "pdf-compressor": "Compress PDF",
  "pdf-to-images": "PDF to Images",
  "pdf-page-manager": "PDF Page Manager",
  "pdf-to-text": "PDF to Text",
  "media-converter": "Media Converter",
  "audio-extractor": "Extract Audio from Video",
  "zip-creator": "ZIP Creator",
  "zip-extractor": "ZIP Extractor",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = toolTitles[slug] ?? "File Tool";
  return { title: `${title} | Online Fetcher Tools`, description: `${title} — a fast, private Online Fetcher Tools utility.` };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = toolTitles[slug] ?? "File Tool";
  const isYoutube = slug === "youtube";
  const isVideoEditor = slug === "video-editor";
  const isPdfManager = slug === "pdf-page-manager";
  const isPhotoEditor = slug === "image-cropper" || slug === "image-rotator";
  const isZipExtractor = slug === "zip-extractor";

  if (isVideoEditor) {
    return (
      <main className="fixed inset-0 h-screen h-[100dvh] w-screen max-w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col select-none">
        <VideoEditorWorkspace />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.13),_transparent_34%),linear-gradient(180deg,#020817_0%,#0f172a_100%)] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pb-20 sm:pt-10 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300">
            <ChevronLeft className="h-4 w-4" /> All tools
          </Link>
          <BackendStatus />
        </div>
        <div className="mx-auto max-w-4xl pb-6 pt-6 text-center sm:pb-10 sm:pt-16">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Online Fetcher Tools utility</p>
          <h1 className="mt-2 sm:mt-4 text-2xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mx-auto mt-2 sm:mt-4 max-w-2xl text-xs sm:text-base leading-5 sm:leading-7 text-slate-400">
            {isYoutube
              ? "Analyze a public YouTube URL, choose a format, and download content you are permitted to use."
              : isVideoEditor
              ? "Trim, cut, adjust speed, extract frames, and edit videos directly with high quality output and preserved audio."
              : isPdfManager
              ? "Visually reorder pages, remove unwanted sheets, and export a clean customized PDF document."
              : isPhotoEditor
              ? "Fine-tune images with precise cropping, rotation, flipping, and quality controls."
              : isZipExtractor
              ? "Safely inspect ZIP archive contents and extract files with full path-traversal protection."
              : "A focused, privacy-friendly utility that processes your files through the Online Fetcher Tools backend."}
          </p>
        </div>
        {isYoutube ? (
          <DownloaderCard />
        ) : isVideoEditor ? (
          <VideoEditorWorkspace />
        ) : isPdfManager ? (
          <PdfPageManagerWorkspace />
        ) : isPhotoEditor ? (
          <PhotoEditorWorkspace slug={slug} />
        ) : isZipExtractor ? (
          <ZipExtractorWorkspace />
        ) : (
          <FileToolWorkspace slug={slug} />
        )}
        <div className="mx-auto mt-8 flex max-w-4xl items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-300" /> Files are processed temporarily and cleaned up after delivery.
        </div>
      </div>
    </main>
  );
}
