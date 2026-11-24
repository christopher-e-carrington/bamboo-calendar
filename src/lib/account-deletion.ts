import { z } from "zod";

export const accountDeletionConfirmation = z.object({ confirm: z.literal(true) }).strict();

export interface UploadEntry { name: string; id: string | null }
export interface AccountStorage {
  list: (bucket: string, prefix: string, offset: number) => Promise<UploadEntry[]>;
  remove: (bucket: string, paths: string[]) => Promise<void>;
}

/** Only account-owned folders are removed; client-provided file URLs are never trusted. */
export async function purgeAccountUploads(storage: AccountStorage, userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Invalid account identifier");
  }
  for (const bucket of ["documents", "memory-photos"]) {
    const files: string[] = [];
    const visit = async (prefix: string, depth: number): Promise<void> => {
      if (depth > 12) throw new Error("Upload folder is too deeply nested");
      for (let offset = 0; ; offset += 100) {
        const entries = await storage.list(bucket, prefix, offset);
        for (const entry of entries) {
          if (!entry.name || entry.name.includes("/") || entry.name === "." || entry.name === "..") {
            throw new Error("Invalid upload path");
          }
          const path = `${prefix}/${entry.name}`;
          if (entry.id) files.push(path);
          else await visit(path, depth + 1);
        }
        if (entries.length < 100) break;
      }
    };
    await visit(userId, 0);
    for (let start = 0; start < files.length; start += 100) {
      await storage.remove(bucket, files.slice(start, start + 100));
    }
    files.length = 0;
    await visit(userId, 0);
    if (files.length > 0) throw new Error("Some uploaded files could not be removed");
  }
}

export async function completeAccountDeletion(steps: {
  removeUploads: () => Promise<void>;
  removeRecords: () => Promise<void>;
  removeSignIn: () => Promise<void>;
}) {
  await steps.removeUploads();
  await steps.removeRecords();
  await steps.removeSignIn();
}

export function clearAccountDeviceData(storage: Pick<Storage, "length" | "key" | "removeItem">) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("bamboo")) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}