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

export function isSupportedImage(file: File): boolean {
  return file.type in IMAGE_TYPES || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

/** Copies an image into the assets folder and returns the Markdown that references it. */
export async function importImage(notePath: string, file: File | Blob, name?: string): Promise<string> {
  const ext = IMAGE_TYPES[file.type] ?? "png";
  const fileName = name ?? (file instanceof File && file.name ? file.name : `paste-${timeStamp()}.${ext}`);
  const assets = useSettings.getState().settings.files.assetsFolder;
  const saved = await ipc.saveAsset(assets, fileName, await blobToBase64(file));
  return `![](${encodeRel(relativeFrom(dirname(notePath), saved))})`;
}

function encodeRel(p: string): string {
  return p.split("/").map((s) => (s === ".." ? s : encodeURIComponent(s))).join("/");
}

export function pastedName(file: Blob): string {
  return `paste-${timeStamp()}.${IMAGE_TYPES[file.type] ?? "png"}`;
}
