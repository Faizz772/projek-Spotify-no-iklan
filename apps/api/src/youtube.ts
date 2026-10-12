import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { promisify } from "node:util";
import type { MediaSearchResult } from "@miusix/contracts";

const execFileAsync = promisify(execFile);
const ytDlpPath = process.env.YT_DLP_PATH ?? "yt-dlp";

type YtDlpEntry = {
  id?: string;
  title?: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  thumbnails?: Array<{ url?: string }>;
};

function parseEntries(value: unknown): YtDlpEntry[] {
  if (!value || typeof value !== "object") return [];
  const entries = (value as { entries?: unknown }).entries;
  return Array.isArray(entries) ? entries as YtDlpEntry[] : [];
}

export async function searchYouTube(query: string): Promise<MediaSearchResult[]> {
  const { stdout } = await execFileAsync(
    ytDlpPath,
    [
      "--dump-single-json",
      "--flat-playlist",
      "--skip-download",
      "--no-warnings",
      "--js-runtimes",
      "node",
      `ytsearch8:${query}`,
    ],
    { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 },
  );

  return parseEntries(JSON.parse(stdout))
    .filter((entry): entry is YtDlpEntry & { id: string; title: string } =>
      Boolean(entry.id?.match(/^[A-Za-z0-9_-]{11}$/) && entry.title))
    .map((entry) => ({
      provider: "youtube" as const,
      sourceId: entry.id,
      title: entry.title,
      artist: entry.channel ?? entry.uploader ?? "YouTube",
      durationSeconds: Math.max(0, Math.round(entry.duration ?? 0)),
      thumbnailUrl: entry.thumbnails?.at(-1)?.url,
    }));
}

export async function downloadYouTubeAudio(
  sourceId: string,
  trackId: string,
  mediaRoot: string,
) {
  await mkdir(mediaRoot, { recursive: true });
  const outputTemplate = resolve(mediaRoot, `${trackId}.%(ext)s`);
  const { stdout } = await execFileAsync(
    ytDlpPath,
    [
      "--no-playlist",
      "--no-progress",
      "--no-warnings",
      "--js-runtimes",
      "node",
      "--restrict-filenames",
      "--format",
      "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
      "--output",
      outputTemplate,
      "--print",
      "after_move:filepath",
      `https://www.youtube.com/watch?v=${sourceId}`,
    ],
    { maxBuffer: 8 * 1024 * 1024, timeout: 180_000 },
  );
  const filePath = stdout.trim().split("\n").at(-1);
  if (!filePath) throw new Error("yt-dlp did not return a downloaded file");

  const extension = extname(filePath).toLowerCase();
  const mimeType = extension === ".m4a"
    ? "audio/mp4"
    : extension === ".wav"
      ? "audio/wav"
      : "audio/webm";
  return { filePath: resolve(filePath), mimeType };
}
