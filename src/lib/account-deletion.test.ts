import { describe, expect, it, vi } from "vitest";
import { accountDeletionConfirmation, clearAccountDeviceData, completeAccountDeletion, purgeAccountUploads, type AccountStorage, type UploadEntry } from "./account-deletion";

const accountId = "11111111-1111-4111-8111-111111111111";

describe("account deletion", () => {
  it("requires explicit permanent-deletion confirmation", () => {
    expect(accountDeletionConfirmation.safeParse({ confirm: false }).success).toBe(false);
    expect(accountDeletionConfirmation.safeParse({}).success).toBe(false);
    expect(accountDeletionConfirmation.safeParse({ confirm: true }).success).toBe(true);
  });

  it("rejects a caller-supplied target account identifier", () => {
    expect(accountDeletionConfirmation.safeParse({ confirm: true, userId: "22222222-2222-4222-8222-222222222222" }).success).toBe(false);
  });

  it("removes all account-folder uploads across pages, including nested files", async () => {
    const files = new Map<string, UploadEntry[]>([
      [`documents/${accountId}`, Array.from({ length: 105 }, (_, index) => ({ name: `file-${index}`, id: `id-${index}` }))],
      [`memory-photos/${accountId}`, [{ name: "album", id: null }]],
      [`memory-photos/${accountId}/album`, [{ name: "photo.jpg", id: "photo" }]],
    ]);
    const removed: string[] = [];
    const storage: AccountStorage = {
      list: async (bucket, prefix, offset) => (files.get(`${bucket}/${prefix}`) ?? []).slice(offset, offset + 100),
      remove: async (bucket, paths) => {
        for (const path of paths) {
          removed.push(`${bucket}/${path}`);
          const slash = path.lastIndexOf("/");
          const key = `${bucket}/${path.slice(0, slash)}`;
          files.set(key, (files.get(key) ?? []).filter((file) => file.name !== path.slice(slash + 1)));
        }
      },
    };
    await purgeAccountUploads(storage, accountId);
    expect(removed).toHaveLength(106);
    expect(removed).toContain(`documents/${accountId}/file-104`);
    expect(removed).toContain(`memory-photos/${accountId}/album/photo.jpg`);
    expect(removed.every((path) => path.startsWith(`documents/${accountId}/`) || path.startsWith(`memory-photos/${accountId}/`))).toBe(true);
  });

  it("never proceeds to records or auth deletion if file cleanup fails", async () => {
    const removeRecords = vi.fn();
    const removeSignIn = vi.fn();
    await expect(completeAccountDeletion({ removeUploads: async () => { throw new Error("storage unavailable"); }, removeRecords, removeSignIn })).rejects.toThrow("storage unavailable");
    expect(removeRecords).not.toHaveBeenCalled();
    expect(removeSignIn).not.toHaveBeenCalled();
  });

  it("never deletes the sign-in account after record-cleanup failure", async () => {
    const removeSignIn = vi.fn();
    await expect(completeAccountDeletion({ removeUploads: async () => {}, removeRecords: async () => { throw new Error("database cleanup failed"); }, removeSignIn })).rejects.toThrow("database cleanup failed");
    expect(removeSignIn).not.toHaveBeenCalled();
  });

  it("deletes sign-in only after files and records succeed", async () => {
    const order: string[] = [];
    await completeAccountDeletion({ removeUploads: async () => { order.push("files"); }, removeRecords: async () => { order.push("records"); }, removeSignIn: async () => { order.push("auth"); } });
    expect(order).toEqual(["files", "records", "auth"]);
  });

  it("rejects paths that could escape the verified account folder", async () => {
    const remove = vi.fn();
    await expect(purgeAccountUploads({ list: async () => [{ name: "../other-account/private.pdf", id: "file" }], remove }, accountId)).rejects.toThrow("Invalid upload path");
    expect(remove).not.toHaveBeenCalled();
  });

  it("does not report success when a nested file remains after storage removal", async () => {
    await expect(purgeAccountUploads({
      list: async (_bucket, prefix) => prefix === accountId ? [{ name: "album", id: null }] : [{ name: "photo.jpg", id: "remaining-file" }],
      remove: async () => {},
    }, accountId)).rejects.toThrow("Some uploaded files could not be removed");
  });

  it("clears Bamboo cached data and offline edits without clearing unrelated site data", () => {
    const data = new Map([["bamboo:cache:v1", "private content"], ["bamboo:offline-queue:v1", "pending private edit"], ["bamboo.theme", "aura"], ["unrelated", "keep"]]);
    clearAccountDeviceData({ get length() { return data.size; }, key: (index) => [...data.keys()][index] ?? null, removeItem: (key) => { data.delete(key); } });
    expect([...data.entries()]).toEqual([["unrelated", "keep"]]);
  });
});