import type { Track } from "@miusix/contracts";
import MusicApp from "./music-app";

const tracks: Track[] = [
  {
    id: "45a6ad78-bdd2-4f5e-9737-4858c929f238",
    title: "Velvet Static",
    artist: "Mira Vale",
    album: "Signals After Dark",
    durationSeconds: 246,
    artwork: { background: "#f25f3a", accent: "#111111", label: "VS" },
    streamUrl: "/audio/velvet-static.mp3",
    explicit: false
  },
  {
    id: "dcd5551e-e855-4651-a5bb-c26ee32d764c",
    title: "Soft Collision",
    artist: "June Archive",
    album: "Room Tone",
    durationSeconds: 198,
    artwork: { background: "#bedc64", accent: "#111111", label: "SC" },
    streamUrl: "/audio/soft-collision.mp3",
    explicit: false
  },
  {
    id: "8791268b-dcad-46f4-a73a-5359c2fc4b75",
    title: "Last Train Bloom",
    artist: "Neon Palms",
    album: "Night Transit",
    durationSeconds: 224,
    artwork: { background: "#6657e8", accent: "#f4eddf", label: "LT" },
    streamUrl: "/audio/last-train-bloom.mp3",
    explicit: false
  },
  {
    id: "9b9e29d0-7750-4ea5-a51a-e943630220ab",
    title: "Paper Satellites",
    artist: "Low Weather",
    album: "Human Frequency",
    durationSeconds: 271,
    artwork: { background: "#48a8a1", accent: "#111111", label: "PS" },
    streamUrl: "/audio/paper-satellites.mp3",
    explicit: false
  }
];

export default function App() {
  return <MusicApp initialTracks={tracks} />;
}
