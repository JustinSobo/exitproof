"use client";

import { useEffect, useState } from "react";
import type { EvidenceFile } from "@/lib/types";

function isImageMime(mime: string | null | undefined, fileName: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp)$/i.test(fileName);
}

export function EvidencePreview({ file }: { file: EvidenceFile }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [demoStub, setDemoStub] = useState(false);
  const image = isImageMime(file.mime_type, file.file_name);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/evidence/${file.id}/url`);
        const data = (await res.json()) as {
          url?: string | null;
          demo?: boolean;
        };
        if (cancelled) return;
        if (data.demo) {
          setDemoStub(true);
          return;
        }
        if (data.url) setPreviewUrl(data.url);
      } catch {
        /* preview is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file.id, image]);

  return (
    <div className="flex max-w-xs flex-col gap-1.5 rounded-md border border-[var(--line)] bg-black/20 p-2">
      {image ? (
        previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={file.file_name}
            className="max-h-28 w-full rounded object-contain"
          />
        ) : (
          <div className="flex h-20 items-center justify-center rounded bg-white/5 text-[10px] text-[var(--fog)]">
            {demoStub ? "Demo — preview stub" : "Loading preview…"}
          </div>
        )
      ) : (
        <div className="flex h-14 items-center justify-center rounded bg-white/5 text-[10px] uppercase tracking-wide text-[var(--fog)]">
          {file.mime_type === "application/pdf" ||
          file.file_name.toLowerCase().endsWith(".pdf")
            ? "PDF"
            : "File"}
        </div>
      )}
      <a
        href={`/api/evidence/${file.id}/download`}
        className="truncate text-xs text-[var(--teal-bright)] hover:underline"
        title={file.file_name}
      >
        {file.file_name}
      </a>
      {file.uploaded_by?.startsWith("system:") ||
      file.collection_source?.startsWith("system") ? (
        <p className="text-[9px] uppercase tracking-wide text-[var(--amber)]">
          System-collected
        </p>
      ) : (
        <p className="text-[9px] uppercase tracking-wide text-[var(--fog)]">
          Human-attached
        </p>
      )}
      {file.content_hash ? (
        <p className="truncate font-mono text-[9px] text-[var(--fog)]" title={file.content_hash}>
          SHA-256 {file.content_hash.slice(0, 12)}…
        </p>
      ) : null}
    </div>
  );
}
