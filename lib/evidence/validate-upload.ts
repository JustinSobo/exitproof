import { z } from "zod";

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_EVIDENCE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

const MIME_BY_EXT: Record<(typeof ALLOWED_EVIDENCE_MIMES)[number], string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

const EXT_TO_MIME: Record<string, (typeof ALLOWED_EVIDENCE_MIMES)[number]> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const evidenceUploadSchema = z.object({
  itemId: z.string().trim().min(1, "item_id is required"),
  fileName: z.string().trim().min(1, "file name is required").max(255),
  mimeType: z.string(),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_EVIDENCE_BYTES, "File must be 10 MB or smaller"),
});

export type ValidatedEvidenceUpload = {
  itemId: string;
  fileName: string;
  mimeType: (typeof ALLOWED_EVIDENCE_MIMES)[number];
  size: number;
};

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  return fileName.slice(i).toLowerCase();
}

/**
 * Server-side evidence upload checks: zod shape, 10 MB cap, MIME + extension allowlist.
 */
export function validateEvidenceUpload(input: {
  itemId: string;
  fileName: string;
  mimeType: string;
  size: number;
}): { ok: true; data: ValidatedEvidenceUpload } | { ok: false; error: string } {
  const parsed = evidenceUploadSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid upload";
    return { ok: false, error: first };
  }

  const { itemId, fileName, size } = parsed.data;
  const ext = extensionOf(fileName);
  const inferred = EXT_TO_MIME[ext];
  if (!inferred) {
    return {
      ok: false,
      error: "Only PNG, JPG, WebP, and PDF files are allowed",
    };
  }

  const rawMime = parsed.data.mimeType.trim().toLowerCase();
  const mimeType =
    !rawMime || rawMime === "application/octet-stream" ? inferred : rawMime;

  if (!(ALLOWED_EVIDENCE_MIMES as readonly string[]).includes(mimeType)) {
    return {
      ok: false,
      error: "Only PNG, JPG, WebP, and PDF files are allowed",
    };
  }

  const allowedExts = MIME_BY_EXT[mimeType as (typeof ALLOWED_EVIDENCE_MIMES)[number]];
  if (!allowedExts.includes(ext)) {
    return {
      ok: false,
      error: "File extension does not match its content type",
    };
  }

  return {
    ok: true,
    data: {
      itemId,
      fileName,
      mimeType: mimeType as (typeof ALLOWED_EVIDENCE_MIMES)[number],
      size,
    },
  };
}
