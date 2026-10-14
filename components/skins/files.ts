import type { DroppedFile } from "@/lib/skins/assets";

// Reading what the person dropped or chose: files, or a folder dragged in (its files, a few
// levels deep). Blobs are read with FileReader (jsdom has no blob.arrayBuffer in every version).

/** A dropped folder never yields more files than this (a mascot set is 36). */
export const MAX_DROPPED_FILES = 120;
const MAX_FOLDER_DEPTH = 3;

export function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const { result } = reader;
      if (result === null || typeof result === "string") reject(new Error("FileReader gave no bytes"));
      else resolve(new Uint8Array(result));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsArrayBuffer(blob);
  });
}

export async function readDropped(files: readonly File[]): Promise<readonly DroppedFile[]> {
  return Promise.all(files.map(async (file) => ({ name: file.name, bytes: await readBytes(file) })));
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readBatch(reader: FileSystemDirectoryReader): Promise<readonly FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

/** A directory's entries: readEntries answers in batches until it returns none. */
async function directoryEntries(directory: FileSystemDirectoryEntry): Promise<readonly FileSystemEntry[]> {
  const reader = directory.createReader();
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await readBatch(reader);
    if (batch.length === 0 || all.length >= MAX_DROPPED_FILES) return all;
    all.push(...batch);
  }
}

async function entryFiles(entry: FileSystemEntry, depth: number): Promise<readonly File[]> {
  if (isFileEntry(entry)) return [await entryFile(entry)];
  if (!isDirectoryEntry(entry) || depth >= MAX_FOLDER_DEPTH) return [];
  const children = await directoryEntries(entry);
  const nested = await Promise.all(children.map((child) => entryFiles(child, depth + 1)));
  return nested.flat();
}

/** The files in a drop: a dragged folder is opened; plain files come as they are. */
export async function droppedFiles(data: DataTransfer): Promise<readonly File[]> {
  const items = data.items ? [...data.items] : [];
  const entries = items.flatMap((item) => {
    const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
    return entry === null ? [] : [entry];
  });
  if (entries.length === 0) return [...data.files].slice(0, MAX_DROPPED_FILES);
  const files = await Promise.all(entries.map((entry) => entryFiles(entry, 0)));
  return files.flat().slice(0, MAX_DROPPED_FILES);
}
