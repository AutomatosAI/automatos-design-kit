import { useCallback, useState } from "react";

import { failed, type Notice } from "@/components/looks/LookNotice";
import { downloadBlob } from "@/components/looks/download";
import { sendSkin, type SkinTarget } from "@/lib/client/skins";
import { ownBuffer } from "@/lib/skins/assets";
import { importDraft, packDraft } from "@/lib/skins/draft-pack";
import { PACKAGE_MAX_BYTES, type SkinError } from "@/lib/skins/format";
import type { SkinDraft } from "@/lib/skins/model";
import { AUTOSKIN_TYPE } from "@/lib/skins/pack";
import { formatBytes } from "@/lib/skins/validate-files";

import { readBytes } from "./files";
import type { SkinAssetsApi } from "./useSkinAssets";

// What Export, Import, Load into my Automatos and Submit do (PRD-004 K-007). Every way out packs
// the draft through the validator first, so a skin Studio would refuse never leaves the kit,
// and an imported file is validated before it touches the draft or the stored files.

export const NOT_EXPORTED = "The skin wasn't exported.";
export const NOT_IMPORTED = "That file wasn't imported.";
export const NOT_SENT = "The skin wasn't sent.";
export const DOWNLOAD_FAILED = "The download didn't start. Try again.";
export const READ_FAILED = "The file couldn't be read. Try choosing it again.";
export const SENDING: Readonly<Record<SkinTarget, string>> = {
  import: "Loading the skin into your Automatos…",
  submit: "Sending the skin to the Marketplace…",
};

export interface PackActions {
  readonly notice: Notice | null;
  /** The send in progress, if any: the send buttons wait for it. */
  readonly busy: SkinTarget | null;
  exportSkin(): void;
  importFile(file: File): Promise<void>;
  send(target: SkinTarget): Promise<void>;
}

/** One validator error as a line a person can act on. */
export function errorLine(error: SkinError): string {
  return error.path === "$" ? error.message : `${error.path}: ${error.message}`;
}

function done(text: string): Notice {
  return { kind: "done", text };
}

async function readImport(file: File): Promise<Uint8Array | string> {
  if (file.size > PACKAGE_MAX_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}; a .autoskin may be at most ${formatBytes(PACKAGE_MAX_BYTES)}.`;
  }
  try {
    return await readBytes(file);
  } catch (error) {
    console.error(`[skins] ${file.name} couldn't be read:`, error);
    return READ_FAILED;
  }
}

export function usePackActions(draft: SkinDraft, assets: SkinAssetsApi, onImport: (draft: SkinDraft) => void): PackActions {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<SkinTarget | null>(null);

  const exportSkin = useCallback(() => {
    const packed = packDraft(draft, assets.assets);
    if (!packed.ok) return setNotice(failed(NOT_EXPORTED, packed.errors.map(errorLine)));
    try {
      downloadBlob(packed.fileName, new Blob([ownBuffer(packed.bytes)], { type: AUTOSKIN_TYPE }));
      setNotice(done(`Exported ${packed.fileName}.`));
    } catch (error) {
      console.error("[skins] the .autoskin download didn't start:", error);
      setNotice(failed(NOT_EXPORTED, [DOWNLOAD_FAILED]));
    }
  }, [draft, assets.assets]);

  const importFile = useCallback(
    async (file: File) => {
      const bytes = await readImport(file);
      if (typeof bytes === "string") return setNotice(failed(NOT_IMPORTED, [bytes]));
      const imported = importDraft(bytes);
      if (!imported.ok) return setNotice(failed(NOT_IMPORTED, imported.errors.map(errorLine)));
      onImport(imported.draft);
      await assets.remove([...assets.assets.keys()]);
      await assets.add(imported.assets);
      const replaced = `Imported ${imported.draft.meta.name}. Its font and mascot files replace the ones you had.`;
      setNotice(done([replaced, ...imported.notes].join(" ")));
    },
    [assets, onImport],
  );

  const send = useCallback(
    async (target: SkinTarget) => {
      const packed = packDraft(draft, assets.assets);
      if (!packed.ok) return setNotice(failed(NOT_SENT, packed.errors.map(errorLine)));
      setBusy(target);
      setNotice(done(SENDING[target]));
      const result = await sendSkin(target, { bytes: packed.bytes, fileName: packed.fileName, name: packed.skin.name });
      setBusy(null);
      setNotice(result.ok ? done(result.message) : failed(result.message, result.reasons));
    },
    [draft, assets.assets],
  );

  return { notice, busy, exportSkin, importFile, send };
}
