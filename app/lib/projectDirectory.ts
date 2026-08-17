import { ProjectMedia } from "./projectFile";

const DATABASE = "lyricstapper-project-directories";
const STORE = "handles";

type LocalDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (options: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};

export type LocalProjectFileHandle = FileSystemFileHandle;

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite" }) => Promise<LocalDirectoryHandle>;
  showOpenFilePicker?: (options?: object) => Promise<LocalProjectFileHandle[]>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function rememberDirectory(id: string, handle: LocalDirectoryHandle): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(handle, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function saveProjectInDirectory(
  filename: string,
  contentForDirectory: (directoryId: string) => string,
): Promise<
  | { status: "saved"; fileHandle: LocalProjectFileHandle; directoryId: string }
  | { status: "cancelled" | "unsupported" }
> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return { status: "unsupported" };
  try {
    const directory = await picker({ id: "lyricstapper-projects", mode: "readwrite" });
    const directoryId = crypto.randomUUID();
    const fileHandle = await directory.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(contentForDirectory(directoryId));
    await writable.close();
    await rememberDirectory(directoryId, directory);
    return { status: "saved", fileHandle, directoryId };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { status: "cancelled" };
    throw error;
  }
}

export async function chooseProjectFile(): Promise<
  | { status: "selected"; file: File; handle: LocalProjectFileHandle }
  | { status: "cancelled" | "unsupported" }
> {
  const picker = (window as DirectoryPickerWindow).showOpenFilePicker;
  if (!picker) return { status: "unsupported" };
  try {
    const [handle] = await picker({
      multiple: false,
      types: [{ description: "Lyricstapper project or captions", accept: { "application/json": [".json"], "text/plain": [".srt", ".ass"] } }],
    });
    return handle ? { status: "selected", file: await handle.getFile(), handle } : { status: "cancelled" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { status: "cancelled" };
    throw error;
  }
}

export async function overwriteProjectFile(handle: LocalProjectFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function findProjectMedia(directoryId: string, media: ProjectMedia): Promise<File | null> {
  const database = await openDatabase();
  const directory = await new Promise<LocalDirectoryHandle | undefined>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(directoryId);
    request.onsuccess = () => resolve(request.result as LocalDirectoryHandle | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!directory) return null;
  const permission = await directory.queryPermission({ mode: "read" });
  if (permission !== "granted") return null;
  try {
    return await (await directory.getFileHandle(media.name)).getFile();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw error;
  }
}
