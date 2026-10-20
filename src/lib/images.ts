import { blobToBase64, ipc } from "./ipc";
import { dirname, relativeFrom } from "./paths";
import { timeStamp } from "./daily";
import { useSettings } from "@/stores/settings";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const ATTACHMENT_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/flac": "flac",
};

export const AUDIO_EXT = /\.(mp3|wav|ogg|oga|opus|m4a|aac|webm|flac)$/i;
export const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

export function isSupportedImage(file: File): boolean {
  return file.type in IMAGE_TYPES || IMAGE_EXT.test(file.name);
}

/** Images, PDFs and audio can be dropped into a note. */
export function isSupportedAttachment(file: File): boolean {
  return file.type in ATTACHMENT_TYPES || IMAGE_EXT.test(file.name) || AUDIO_EXT.test(file.name) || /\.pdf$/i.test(file.name);
}

/** Markdown for an attachment: images and audio use `![]()` (audio becomes a player), everything else a link. */
export function attachmentMarkdown(savedRelPath: string, label: string): string {
  const url = encodeRel(savedRelPath);
  const isMedia = IMAGE_EXT.test(savedRelPath) || AUDIO_EXT.test(savedRelPath);
  return isMedia ? `![${IMAGE_EXT.test(savedRelPath) ? "" : label}](${url})` : `[${label}](${url})`;
}

/** Copies a file into the assets folder and returns the Markdown that references it. */
export async function importAttachment(notePath: string, file: File | Blob, name?: string): Promise<string> {
  const ext = ATTACHMENT_TYPES[file.type.split(";")[0] ?? ""] ?? "png";
  const fileName = name ?? (file instanceof File && file.name ? file.name : `paste-${timeStamp()}.${ext}`);
  const assets = useSettings.getState().settings.files.assetsFolder;
  const saved = await ipc.saveAsset(assets, fileName, await blobToBase64(file));
  return attachmentMarkdown(relativeFrom(dirname(notePath), saved), fileName.replace(/\.[^.]+$/, ""));
}

/** Kept for existing callers: same as `importAttachment`. */
export const importImage = importAttachment;

function encodeRel(p: string): string {
  return p.split("/").map((s) => (s === ".." ? s : encodeURIComponent(s))).join("/");
}

export function pastedName(file: Blob): string {
  return `paste-${timeStamp()}.${ATTACHMENT_TYPES[file.type.split(";")[0] ?? ""] ?? "png"}`;
}
