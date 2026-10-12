import type { Catalog, Track } from "@miusix/contracts";

export const demoTracks: Track[] = [
  {
    id: "45a6ad78-bdd2-4f5e-9737-4858c929f238",
    title: "Velvet Static",
    artist: "Mira Vale",
    album: "Signals After Dark",
    durationSeconds: 246,
    artwork: { background: "#f25f3a", accent: "#111111", label: "VS" },
    streamUrl: "/v1/tracks/45a6ad78-bdd2-4f5e-9737-4858c929f238/stream",
    explicit: false
  },
  {
    id: "dcd5551e-e855-4651-a5bb-c26ee32d764c",
    title: "Soft Collision",
    artist: "June Archive",
    album: "Room Tone",
    durationSeconds: 198,
    artwork: { background: "#bedc64", accent: "#111111", label: "SC" },
    streamUrl: "/v1/tracks/dcd5551e-e855-4651-a5bb-c26ee32d764c/stream",
    explicit: false
  },
  {
    id: "8791268b-dcad-46f4-a73a-5359c2fc4b75",
    title: "Last Train Bloom",
    artist: "Neon Palms",
    album: "Night Transit",
    durationSeconds: 224,
    artwork: { background: "#6657e8", accent: "#f4eddf", label: "LT" },
    streamUrl: "/v1/tracks/8791268b-dcad-46f4-a73a-5359c2fc4b75/stream",
    explicit: false
  },
  {
    id: "9b9e29d0-7750-4ea5-a51a-e943630220ab",
    title: "Paper Satellites",
    artist: "Low Weather",
    album: "Human Frequency",
    durationSeconds: 271,
    artwork: { background: "#48a8a1", accent: "#111111", label: "PS" },
    streamUrl: "/v1/tracks/9b9e29d0-7750-4ea5-a51a-e943630220ab/stream",
    explicit: false
  }
];

export const demoCatalog: Catalog = {
  featured: demoTracks,
  recentlyPlayed: [...demoTracks].reverse(),
  playlists: [
    {
      id: "cba0d3c6-07d1-4303-bfb8-c1500caf9f80",
      title: "Night drive, no destination",
      description: "Four tracks for the long way home.",
      trackIds: demoTracks.map((track) => track.id)
    }
  ]
};
