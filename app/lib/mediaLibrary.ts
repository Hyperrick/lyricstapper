import { ProjectMedia } from "./projectFile";

export type LocalFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  queryPermission?: (options: { mode: "read" }) => Promise<PermissionState>;
};

type PickerWindow = Window & {
  showOpenFilePicker?: (options: object) => Promise<LocalFileHandle[]>;
};

const DATABASE = "lyricstapper-media-library";
const STORE = "handles";

function mediaKey(media: Pick<ProjectMedia, "name" | "size" | "lastModified">): string {
  return `${media.name}:${media.size ?? 0}:${media.lastModified ?? 0}`;
}

function mediaNameKey(name: string): string {
  return `name:${name}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function chooseRememberedMedia(): Promise<{ file: File; handle?: LocalFileHandle } | null> {
  const picker = (window as PickerWindow).showOpenFilePicker;
  if (!picker) return null;
  try {
    const [handle] = await picker({
      multiple: false,
      types: [{ description: "Audio or video", accept: { "video/*": [".mp4", ".mov"], "audio/*": [".mp3", ".wav", ".m4a"] } }],
    });
    return handle ? { file: await handle.getFile(), handle } : null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

export function supportsRememberedMedia(): boolean {
  return typeof (window as PickerWindow).showOpenFilePicker === "function";
}

export async function rememberMedia(file: File, handle: LocalFileHandle): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(handle, mediaKey(file));
    transaction.objectStore(STORE).put(handle, mediaNameKey(file.name));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function recallMedia(media: ProjectMedia): Promise<File | null> {
  const database = await openDatabase();
  const handle = await new Promise<LocalFileHandle | undefined>((resolve, reject) => {
    const key = media.size && media.lastModified ? mediaKey(media) : mediaNameKey(media.name);
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as LocalFileHandle | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!handle) return null;
  const permission = handle.queryPermission ? await handle.queryPermission({ mode: "read" }) : "granted";
  return permission === "granted" ? handle.getFile() : null;
}
