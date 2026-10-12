import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  importMediaRequestSchema,
  trackSchema,
  type ImportMediaRequest,
  type Track,
} from "@miusix/contracts";
import { z } from "zod";
import { demoCatalog, demoTracks } from "./catalog.js";
import { closeDatabase, pool } from "./db.js";
import { downloadYouTubeAudio, searchYouTube } from "./youtube.js";

const app = Fastify({ logger: true });
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";
const mediaRoot = resolve(process.env.MEDIA_ROOT ?? "./storage/media");
const youtubeImportsEnabled = process.env.ENABLE_YOUTUBE_IMPORTS === "true";

type CachedTrack = {
  track: Track;
  sourceId: string;
  filePath: string;
  mimeType: string;
};

const memoryTracks = new Map<string, CachedTrack>();

function artworkFor(input: ImportMediaRequest) {
  const palettes = [
    ["#f25f3a", "#111111"],
    ["#bedc64", "#111111"],
    ["#6657e8", "#f4eddf"],
    ["#48a8a1", "#111111"],
  ] as const;
  const palette = palettes[input.sourceId.charCodeAt(0) % palettes.length] ?? palettes[0];
  const label = input.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "YT";
  return { background: palette[0], accent: palette[1], label };
}

function trackFromRow(row: Record<string, unknown>): Track {
  return trackSchema.parse({
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    durationSeconds: row.duration_seconds,
    artwork: row.artwork,
    streamUrl: `/v1/tracks/${row.id}/stream`,
    explicit: row.explicit,
  });
}

await app.register(cors, {
  origin: process.env.WEB_ORIGIN?.split(",") ?? true,
  credentials: true
});

app.get("/health", async () => ({
  status: "ok",
  service: "miusix-api",
  version: "0.1.0"
}));

async function listTracks(): Promise<Track[]> {
  if (!pool) return demoTracks;
  try {
    const result = await pool.query(
      `select id, title, artist, album, duration_seconds, artwork, explicit
       from tracks where download_status = 'ready' order by created_at desc`
    );
    if (result.rowCount === 0) return [...memoryTracks.values()].map(({ track }) => track).concat(demoTracks);
    return result.rows.map(trackFromRow);
  } catch (error) {
    app.log.warn({ error }, "database unavailable; serving demo catalog");
    return demoTracks;
  }
}

app.get("/v1/tracks", async () => listTracks());

app.get("/v1/catalog", async () => {
  const tracks = await listTracks();
  return {
    ...demoCatalog,
    featured: tracks,
    recentlyPlayed: [...tracks].reverse()
  };
});

app.get("/v1/search", async (request, reply) => {
  const { q } = z.object({ q: z.string().trim().min(2).max(120) }).parse(request.query);
  try {
    return await searchYouTube(q);
  } catch (error) {
    app.log.error({ error }, "YouTube search failed");
    return reply.code(503).send({
      message: "Search provider is unavailable. Check yt-dlp installation and outbound access.",
    });
  }
});

app.post("/v1/imports", async (request, reply) => {
  if (!youtubeImportsEnabled) {
    return reply.code(403).send({
      message: "Media imports are disabled. Set ENABLE_YOUTUBE_IMPORTS=true for content you may lawfully save.",
    });
  }
  const input = importMediaRequestSchema.parse(request.body);

  const memoryMatch = [...memoryTracks.values()].find(({ sourceId }) => sourceId === input.sourceId);
  if (memoryMatch) return memoryMatch.track;

  if (pool) {
    const existing = await pool.query(
      `select id, title, artist, album, duration_seconds, artwork, explicit
       from tracks
       where source_provider = $1 and external_id = $2 and download_status = 'ready'
       limit 1`,
      [input.provider, input.sourceId],
    );
    if (existing.rows[0]) return trackFromRow(existing.rows[0]);
  }

  const id = randomUUID();
  try {
    const media = await downloadYouTubeAudio(input.sourceId, id, mediaRoot);
    let track = trackSchema.parse({
      id,
      title: input.title,
      artist: input.artist,
      album: "YouTube Music",
      durationSeconds: input.durationSeconds,
      artwork: artworkFor(input),
      streamUrl: `/v1/tracks/${id}/stream`,
      explicit: false,
    });

    if (pool) {
      const saved = await pool.query(
        `insert into tracks (
          id, title, artist, album, duration_seconds, artwork, explicit,
          source_provider, external_id, source_url, media_path, mime_type, download_status
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ready')
        on conflict (source_provider, external_id) where external_id is not null
        do update set
          title = excluded.title,
          artist = excluded.artist,
          duration_seconds = excluded.duration_seconds,
          media_path = excluded.media_path,
          mime_type = excluded.mime_type,
          download_status = 'ready'
        returning id, title, artist, album, duration_seconds, artwork, explicit`,
        [
          id,
          track.title,
          track.artist,
          track.album,
          track.durationSeconds,
          track.artwork,
          track.explicit,
          input.provider,
          input.sourceId,
          `https://www.youtube.com/watch?v=${input.sourceId}`,
          basename(media.filePath),
          media.mimeType,
        ],
      );
      if (saved.rows[0]) track = trackFromRow(saved.rows[0]);
    } else {
      memoryTracks.set(id, { track, sourceId: input.sourceId, ...media });
    }
    return reply.code(201).send(track);
  } catch (error) {
    app.log.error({ error, sourceId: input.sourceId }, "media import failed");
    return reply.code(502).send({ message: "The audio could not be cached by yt-dlp." });
  }
});

app.get("/v1/tracks/:id", async (request, reply) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const track = (await listTracks()).find((item) => item.id === id);
  return track ?? reply.code(404).send({ message: "Track not found" });
});

app.get("/v1/tracks/:id/stream", async (request, reply) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const memoryTrack = memoryTracks.get(id);
  let mediaPath = memoryTrack?.filePath ?? `${id}.mp3`;
  let mimeType = memoryTrack?.mimeType ?? "audio/mpeg";

  if (!memoryTrack && pool) {
    const result = await pool.query(
      "select media_path, mime_type from tracks where id = $1 and download_status = 'ready'",
      [id],
    );
    if (result.rows[0]?.media_path) {
      mediaPath = result.rows[0].media_path;
      mimeType = result.rows[0].mime_type ?? mimeType;
    }
  }

  const filePath = resolve(mediaRoot, mediaPath);
  if (!filePath.startsWith(`${mediaRoot}${sep}`) || !existsSync(filePath)) {
    return reply.code(404).send({
      message: "Audio is not uploaded yet",
      expectedPath: `storage/media/${id}.mp3`
    });
  }

  const size = statSync(filePath).size;
  const range = request.headers.range;
  reply.header("Accept-Ranges", "bytes").header("Content-Type", mimeType);

  if (!range) {
    reply.header("Content-Length", size);
    return reply.send(createReadStream(filePath));
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) return reply.code(416).send();
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (start >= size || end >= size || start > end) return reply.code(416).send();

  reply
    .code(206)
    .header("Content-Range", `bytes ${start}-${end}/${size}`)
    .header("Content-Length", end - start + 1);
  return reply.send(createReadStream(filePath, { start, end }));
});

app.addHook("onClose", closeDatabase);

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
