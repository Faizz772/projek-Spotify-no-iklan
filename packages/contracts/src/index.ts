import { z } from "zod";

export const artworkSchema = z.object({
  background: z.string(),
  accent: z.string(),
  label: z.string(),
});

export const trackSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  durationSeconds: z.number().int().nonnegative(),
  artwork: artworkSchema,
  streamUrl: z.string(),
  explicit: z.boolean().default(false),
});

export const playlistSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  trackIds: z.array(z.string().uuid()),
});

export const catalogSchema = z.object({
  featured: z.array(trackSchema),
  recentlyPlayed: z.array(trackSchema),
  playlists: z.array(playlistSchema),
});

export const mediaSearchResultSchema = z.object({
  provider: z.literal("youtube"),
  sourceId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().min(1),
  artist: z.string().min(1),
  durationSeconds: z.number().int().nonnegative(),
  thumbnailUrl: z.string().url().optional(),
});

export const importMediaRequestSchema = mediaSearchResultSchema.pick({
  provider: true,
  sourceId: true,
  title: true,
  artist: true,
  durationSeconds: true,
  thumbnailUrl: true,
});

export type Artwork = z.infer<typeof artworkSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Playlist = z.infer<typeof playlistSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type MediaSearchResult = z.infer<typeof mediaSearchResultSchema>;
export type ImportMediaRequest = z.infer<typeof importMediaRequestSchema>;

export type ApiHealth = {
  status: "ok";
  service: "miusix-api";
  version: string;
};
