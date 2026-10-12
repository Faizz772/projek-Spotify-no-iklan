"use client";

import type { MediaSearchResult, Track } from "@miusix/contracts";
import { createMiusixClient } from "@miusix/sdk";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  initialTracks: Track[];
};

type ViewMode = "web" | "ios";
type SearchStatus = "idle" | "searching" | "importing" | "error";
type IosPage = "play" | "search" | "me" | "playlist";
type UserPlaylist = {
  id: string;
  title: string;
  trackIds: string[];
};

const apiBase = import.meta.env.VITE_API_URL?.trim() || "/api";
const api = createMiusixClient(apiBase);

const adelePicks: MediaSearchResult[] = [
  {
    provider: "youtube",
    sourceId: "hLQl3WQQoQ0",
    title: "Someone Like You",
    artist: "Adele",
    durationSeconds: 285,
    thumbnailUrl: "https://i.ytimg.com/vi/hLQl3WQQoQ0/hqdefault.jpg",
  },
  {
    provider: "youtube",
    sourceId: "rYEDA3JcQqw",
    title: "Rolling in the Deep",
    artist: "Adele",
    durationSeconds: 234,
    thumbnailUrl: "https://i.ytimg.com/vi/rYEDA3JcQqw/hqdefault.jpg",
  },
  {
    provider: "youtube",
    sourceId: "YQHsXMglC9A",
    title: "Hello",
    artist: "Adele",
    durationSeconds: 367,
    thumbnailUrl: "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg",
  },
  {
    provider: "youtube",
    sourceId: "X-yIEMduRXk",
    title: "Easy On Me",
    artist: "Adele",
    durationSeconds: 226,
    thumbnailUrl: "https://i.ytimg.com/vi/X-yIEMduRXk/hqdefault.jpg",
  },
];

function apiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${apiBase.replace(/\/$/, "")}${path}`;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function loadIds(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function loadPlaylists() {
  try {
    const value = JSON.parse(localStorage.getItem("miusix:playlists") ?? "[]") as UserPlaylist[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function Artwork({ track, compact = false }: { track: Track; compact?: boolean }) {
  return (
    <span
      className={compact ? "artwork artwork--compact" : "artwork"}
      style={{
        "--art-bg": track.artwork.background,
        "--art-fg": track.artwork.accent,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <span>{track.artwork.label}</span>
      <i />
    </span>
  );
}

function ViewToggle({ value, onChange, inverse = false }: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  inverse?: boolean;
}) {
  return (
    <div className={`view-toggle ${inverse ? "view-toggle--inverse" : ""}`} aria-label="Interface view">
      <button className={value === "web" ? "view-toggle__active" : ""} type="button" onClick={() => onChange("web")}>
        Web
      </button>
      <button className={value === "ios" ? "view-toggle__active" : ""} type="button" onClick={() => onChange("ios")}>
        iOS
      </button>
    </div>
  );
}

function EmbeddedIos({ onViewChange }: { onViewChange: (mode: ViewMode) => void }) {
  const source = `/tactile-player.html?embedded=1&api=${encodeURIComponent(apiBase)}`;

  return (
    <main className="ios-embed-stage">
      <header className="ios-embed-header">
        <a className="ios-preview-brand" href="/" aria-label="Miusix home" onClick={(event) => {
          event.preventDefault();
          onViewChange("web");
        }}>
          <span className="brand-mark">M</span><span>MIUSIX</span>
        </a>
        <span className="ios-preview-label">Original tactile HTML · embedded</span>
        <ViewToggle value="ios" onChange={onViewChange} inverse />
      </header>
      <iframe
        className="ios-embed-frame"
        src={source}
        title="Miusix tactile iOS player"
        allow="autoplay"
      />
    </main>
  );
}

function PlaylistPicker({
  track,
  playlists,
  onClose,
  onAdd,
  onCreate,
}: {
  track: Track | null;
  playlists: UserPlaylist[];
  onClose: () => void;
  onAdd: (playlistId: string, trackId: string) => void;
  onCreate: (title: string, trackId?: string) => void;
}) {
  const [title, setTitle] = useState("");
  if (!track) return null;

  return (
    <div className="playlist-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="playlist-picker" role="dialog" aria-modal="true" aria-label={`Add ${track.title} to a playlist`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="studio-kicker">Save for later</span>
            <h2>Add to playlist</h2>
          </div>
          <button type="button" aria-label="Close playlist picker" onClick={onClose}>×</button>
        </header>
        <div className="playlist-picker__track">
          <Artwork track={track} compact />
          <span><strong>{track.title}</strong><small>{track.artist}</small></span>
        </div>
        <div className="playlist-picker__list">
          {playlists.map((playlist) => {
            const added = playlist.trackIds.includes(track.id);
            return (
              <button type="button" key={playlist.id} disabled={added} onClick={() => onAdd(playlist.id, track.id)}>
                <span className="playlist-mini-art">♫</span>
                <span><strong>{playlist.title}</strong><small>{playlist.trackIds.length} tracks</small></span>
                <b>{added ? "Added" : "＋"}</b>
              </button>
            );
          })}
          {playlists.length === 0 && <p>No playlists yet. Create the first one below.</p>}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            onCreate(title.trim(), track.id);
            setTitle("");
          }}
        >
          <input aria-label="New playlist name" placeholder="New playlist name" value={title} onChange={(event) => setTitle(event.target.value)} />
          <button type="submit">Create & add</button>
        </form>
      </section>
    </div>
  );
}

function QueueDrawer({
  open,
  tracks,
  onClose,
  onPlay,
  onRemove,
  onClear,
}: {
  open: boolean;
  tracks: Track[];
  onClose: () => void;
  onPlay: (track: Track) => void;
  onRemove: (trackId: string) => void;
  onClear: () => void;
}) {
  if (!open) return null;
  return (
    <aside className="queue-drawer" aria-label="Play queue">
      <header>
        <div><span className="studio-kicker">Coming up</span><h2>Play queue</h2></div>
        <button type="button" aria-label="Close queue" onClick={onClose}>×</button>
      </header>
      <div className="queue-drawer__list">
        {tracks.map((track, index) => (
          <div key={`${track.id}-${index}`}>
            <button type="button" onClick={() => onPlay(track)}>
              <span>{(index + 1).toString().padStart(2, "0")}</span>
              <Artwork track={track} compact />
              <span><strong>{track.title}</strong><small>{track.artist}</small></span>
            </button>
            <button type="button" aria-label={`Remove ${track.title} from queue`} onClick={() => onRemove(track.id)}>×</button>
          </div>
        ))}
        {tracks.length === 0 && <p>Your queue is empty. Add a playlist or an individual track.</p>}
      </div>
      {tracks.length > 0 && <button className="queue-clear" type="button" onClick={onClear}>Clear queue</button>}
    </aside>
  );
}

type IosPreviewProps = {
  activeTrack: Track;
  tracks: Track[];
  playlists: UserPlaylist[];
  queueCount: number;
  playing: boolean;
  favorite: boolean;
  favoriteCount: number;
  elapsed: number;
  query: string;
  searchResults: MediaSearchResult[];
  localSearchResults: Track[];
  searchStatus: SearchStatus;
  searchMessage: string;
  onPlayPause: () => void;
  onFavorite: () => void;
  onMove: (direction: number) => void;
  onSeek: (seconds: number) => void;
  onQueryChange: (query: string) => void;
  onSearch: (event: React.FormEvent<HTMLFormElement>) => void;
  onSearchResult: (result: MediaSearchResult) => void;
  onLocalSearchResult: (track: Track) => void;
  onSelectTrack: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  onCreatePlaylist: (title: string) => void;
  onQueuePlaylist: (playlist: UserPlaylist, playNow?: boolean) => void;
  onOpenQueue: () => void;
  onViewChange: (mode: ViewMode) => void;
};

function IosPreview({
  activeTrack,
  tracks,
  playlists,
  queueCount,
  playing,
  favorite,
  favoriteCount,
  elapsed,
  query,
  searchResults,
  localSearchResults,
  searchStatus,
  searchMessage,
  onPlayPause,
  onFavorite,
  onMove,
  onSeek,
  onQueryChange,
  onSearch,
  onSearchResult,
  onLocalSearchResult,
  onSelectTrack,
  onAddToPlaylist,
  onCreatePlaylist,
  onQueuePlaylist,
  onOpenQueue,
  onViewChange,
}: IosPreviewProps) {
  const [page, setPage] = useState<IosPage>("play");
  const [playlistId, setPlaylistId] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const remaining = Math.max(0, activeTrack.durationSeconds - elapsed);
  const selectedPlaylist = playlists.find((playlist) => playlist.id === playlistId);
  const selectedPlaylistTracks = selectedPlaylist
    ? selectedPlaylist.trackIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track))
    : [];
  const visibleResults = searchResults.length
    ? searchResults
    : localSearchResults.length
      ? localSearchResults
      : tracks;

  return (
    <main className="ios-stage ios-stage--skeuo">
      <header className="ios-preview-header">
        <a className="ios-preview-brand" href="#" aria-label="Miusix home">
          <span className="brand-mark">M</span><span>MIUSIX</span>
        </a>
        <span className="ios-preview-label">Tactile player</span>
        <ViewToggle value="ios" onChange={onViewChange} inverse />
      </header>

      <section className="iphone skeuo-phone" aria-label="Miusix iOS turntable interface">
        <div className="iphone__screen skeuo-screen">
          <div className="skeuo-leather">
            <div className="skeuo-stitch" aria-hidden="true" />
            <div className="skeuo-statusbar" aria-hidden="true">
              <span>9:41</span><span>▮▮▮ ᯤ ▱</span>
            </div>

            <div className="skeuo-page">
              {page === "play" && (
                <>
                  <span className="skeuo-plaque">{playing ? "正在播放" : "已暂停"}</span>
                  <section className="skeuo-turntable" aria-label="Turntable">
                    <button
                      type="button"
                      className={`skeuo-vinyl ${playing ? "skeuo-vinyl--playing" : ""}`}
                      aria-label={playing ? "Pause record" : "Play record"}
                      onClick={onPlayPause}
                    >
                      <span className="skeuo-vinyl__shine" />
                      <span className="skeuo-vinyl__label" style={{ "--label-color": activeTrack.artwork.background } as React.CSSProperties}>
                        <strong>{activeTrack.title}</strong><small>{activeTrack.artist}</small>
                      </span>
                    </button>
                    <button className={`skeuo-tonearm ${playing ? "skeuo-tonearm--down" : ""}`} type="button" aria-label="Toggle playback with tonearm" onClick={onPlayPause}>
                      <i className="skeuo-tonearm__pivot" /><i className="skeuo-tonearm__tube" /><i className="skeuo-tonearm__head" />
                    </button>
                  </section>

                  <section className="skeuo-console">
                    <div className="skeuo-console__top">
                      <div className="skeuo-lcd">
                        <div className="skeuo-lcd__meta">
                          <strong>{formatTime(elapsed)}</strong>
                          <span>{tracks.findIndex((track) => track.id === activeTrack.id) + 1 || 1} / {tracks.length}</span>
                          <strong>-{formatTime(remaining)}</strong>
                        </div>
                        <div className="skeuo-lcd__track">
                          <strong>{activeTrack.title}</strong><small>{activeTrack.artist}</small>
                        </div>
                      </div>
                      <button
                        className={`skeuo-heart ${favorite ? "skeuo-heart--active" : ""}`}
                        type="button"
                        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                        aria-pressed={favorite}
                        onClick={onFavorite}
                      >
                        {favorite ? "♥" : "♡"}
                      </button>
                    </div>
                    <input
                      className="skeuo-progress"
                      aria-label="iOS playback position"
                      type="range"
                      min="0"
                      max={activeTrack.durationSeconds}
                      value={Math.min(elapsed, activeTrack.durationSeconds)}
                      onChange={(event) => onSeek(Number(event.target.value))}
                    />
                    <div className="skeuo-transport">
                      <button type="button" aria-label="Previous track" onClick={() => onMove(-1)}>◀</button>
                      <button className="skeuo-play" type="button" aria-label={playing ? "Pause" : "Play"} onClick={onPlayPause}>{playing ? "Ⅱ" : "▶"}</button>
                      <button type="button" aria-label="Next track" onClick={() => onMove(1)}>▶</button>
                    </div>
                    <div className="skeuo-volume"><span>◖</span><input aria-label="Volume" type="range" defaultValue="70" /><span>◖))</span></div>
                  </section>

                  <section className="skeuo-up-next">
                    <header>
                      <span>接下来</span>
                      <button type="button" onClick={onOpenQueue}>播放队列 · {queueCount}</button>
                    </header>
                    {tracks.filter((track) => track.id !== activeTrack.id).slice(0, 2).map((track) => (
                      <div className="skeuo-up-next__row" key={track.id}>
                        <button type="button" onClick={() => onSelectTrack(track)}>
                          <i style={{ "--disc-label": track.artwork.background } as React.CSSProperties} />
                          <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                          <time>{formatTime(track.durationSeconds)}</time>
                        </button>
                        <button type="button" aria-label={`Add ${track.title} to playlist`} onClick={() => onAddToPlaylist(track)}>＋</button>
                      </div>
                    ))}
                  </section>
                </>
              )}

              {page === "search" && (
                <section className="skeuo-search-page">
                  <span className="skeuo-plaque">搜索</span>
                  <form className="skeuo-search" onSubmit={onSearch}>
                    <span>⌕</span>
                    <input aria-label="Search music" placeholder="搜索歌曲、歌手…" value={query} onChange={(event) => onQueryChange(event.target.value)} />
                    <button type="submit" aria-label="Submit search">↵</button>
                  </form>
                  <div className="skeuo-chips" aria-label="Search suggestions">
                    {["Adele", "Hello", "Easy On Me", "Rolling"].map((chip) => (
                      <button type="button" key={chip} onClick={() => onQueryChange(chip)}>{chip}</button>
                    ))}
                  </div>
                  <div className="skeuo-results-heading">
                    <strong>{query.trim() ? "搜索结果" : "热门歌曲"}</strong>
                    <span>{searchStatus === "searching" ? "搜索中…" : searchStatus === "importing" ? "缓存中…" : searchMessage}</span>
                  </div>
                  {searchStatus === "error" && <p className="skeuo-error">{searchMessage}</p>}
                  <div className="skeuo-results">
                    {visibleResults.map((item) => {
                      const isRemote = "sourceId" in item;
                      return (
                        <button
                          type="button"
                          key={isRemote ? item.sourceId : item.id}
                          disabled={searchStatus === "importing"}
                          onClick={() => {
                            if (isRemote) onSearchResult(item);
                            else onLocalSearchResult(item);
                            setPage("play");
                          }}
                        >
                          <i style={{ "--disc-label": isRemote ? "#e8933c" : item.artwork.background } as React.CSSProperties} />
                          <span><strong>{item.title}</strong><small>{item.artist}</small></span>
                          <time>{formatTime(item.durationSeconds)}</time>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {page === "me" && (
                <section className="skeuo-profile-page">
                  <span className="skeuo-plaque">个人主页</span>
                  <div className="skeuo-profile-card">
                    <span className="skeuo-profile-avatar">SW</span>
                    <span><strong>Shuo Wang</strong><small>Personal collection</small></span><b>›</b>
                  </div>
                  <div className="skeuo-stats">
                    <span><strong>{favoriteCount}</strong><small>收藏</small></span>
                    <span><strong>{tracks.length}</strong><small>歌曲</small></span>
                    <span><strong>{playlists.length}</strong><small>歌单</small></span>
                  </div>
                  <div className="skeuo-section-title"><strong className="skeuo-section-label">我的歌单</strong><span>{playlists.length}</span></div>
                  <form
                    className="skeuo-new-playlist"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!newPlaylistName.trim()) return;
                      onCreatePlaylist(newPlaylistName.trim());
                      setNewPlaylistName("");
                    }}
                  >
                    <input aria-label="New playlist name" placeholder="新建歌单…" value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.target.value)} />
                    <button type="submit">＋</button>
                  </form>
                  {playlists.map((playlist) => (
                    <button
                      className="skeuo-playlist-card"
                      type="button"
                      key={playlist.id}
                      onClick={() => {
                        setPlaylistId(playlist.id);
                        setPage("playlist");
                      }}
                    >
                      <i>♫</i>
                      <span><strong>{playlist.title}</strong><small>{playlist.trackIds.length} 首歌曲</small></span><b>›</b>
                    </button>
                  ))}
                  {playlists.length === 0 && <p className="skeuo-empty">还没有歌单，先创建一个吧。</p>}
                </section>
              )}

              {page === "playlist" && selectedPlaylist && (
                <section className="skeuo-playlist-page">
                  <button className="skeuo-back" type="button" onClick={() => setPage("me")}>‹ 我的歌单</button>
                  <div className="skeuo-playlist-hero">
                    <i>♫</i>
                    <span><small>PLAYLIST</small><strong>{selectedPlaylist.title}</strong><b>{selectedPlaylistTracks.length} 首歌曲</b></span>
                  </div>
                  <button className="skeuo-queue-all" type="button" disabled={selectedPlaylistTracks.length === 0} onClick={() => onQueuePlaylist(selectedPlaylist)}>
                    ＋ 全部加入播放队列
                  </button>
                  <div className="skeuo-results">
                    {selectedPlaylistTracks.map((track, index) => (
                      <button type="button" key={track.id} onClick={() => onSelectTrack(track)}>
                        <span className="skeuo-track-no">{(index + 1).toString().padStart(2, "0")}</span>
                        <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                        <time>{formatTime(track.durationSeconds)}</time>
                      </button>
                    ))}
                    {selectedPlaylistTracks.length === 0 && <p className="skeuo-empty">从播放器或歌曲列表中把音乐加入这里。</p>}
                  </div>
                </section>
              )}
            </div>

            <nav className="skeuo-tabs" aria-label="iOS navigation">
              {([
                ["play", "◉", "播放"],
                ["search", "⌕", "搜索"],
                ["me", "♙", "我的"],
              ] as const).map(([tab, icon, label]) => (
                <button className={page === tab || (tab === "me" && page === "playlist") ? "skeuo-tab--active" : ""} type="button" key={tab} onClick={() => setPage(tab)}>
                  <span>{icon}</span><strong>{label}</strong><i />
                </button>
              ))}
            </nav>
            <span className="skeuo-home-indicator" aria-hidden="true" />
          </div>
        </div>
      </section>
      <p className="ios-preview-note">A tactile turntable interface, restored at the reference 390 × 844 proportion.</p>
    </main>
  );
}

export default function MusicApp({ initialTracks }: Props) {
  const [tracks, setTracks] = useState(initialTracks);
  const [activeId, setActiveId] = useState(initialTracks[0]?.id ?? "");
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(38);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    window.location.pathname === "/ios" || window.location.pathname === "/ios/"
      ? "ios"
      : "web");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaSearchResult[]>([]);
  const [localSearchResults, setLocalSearchResults] = useState<Track[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchMessage, setSearchMessage] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(loadIds("miusix:favorites")));
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(loadPlaylists);
  const [queueIds, setQueueIds] = useState<string[]>(() => loadIds("miusix:queue"));
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<{ context: AudioContext; oscillators: OscillatorNode[]; gain: GainNode } | null>(null);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeId) ?? tracks[0],
    [activeId, tracks],
  );
  const favoriteTracks = useMemo(
    () => tracks.filter((track) => favorites.has(track.id)),
    [favorites, tracks],
  );
  const queueTracks = useMemo(
    () => queueIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track)),
    [queueIds, tracks],
  );

  useEffect(() => {
    const syncViewWithUrl = () => {
      setViewMode(
        window.location.pathname === "/ios" || window.location.pathname === "/ios/"
          ? "ios"
          : "web",
      );
    };
    window.addEventListener("popstate", syncViewWithUrl);
    return () => window.removeEventListener("popstate", syncViewWithUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.tracks()
      .then((remoteTracks) => {
        if (cancelled) return;
        setTracks((current) => {
          const remoteIds = new Set(remoteTracks.map((track) => track.id));
          return [...remoteTracks, ...current.filter((track) => !remoteIds.has(track.id))];
        });
      })
      .catch(() => {
        // Keep the built-in demo usable while a self-hosted API is offline.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("miusix:playlists", JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    const syncSharedStorage = (event: StorageEvent) => {
      if (event.key === "miusix:favorites") {
        setFavorites(new Set(loadIds("miusix:favorites")));
      }
      if (event.key === "miusix:playlists") {
        setPlaylists(loadPlaylists());
      }
      if (event.key === "miusix:queue") {
        setQueueIds(loadIds("miusix:queue"));
      }
    };
    window.addEventListener("storage", syncSharedStorage);
    return () => window.removeEventListener("storage", syncSharedStorage);
  }, []);

  useEffect(() => {
    localStorage.setItem("miusix:queue", JSON.stringify(queueIds));
  }, [queueIds]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (synthRef.current) synthRef.current.gain.gain.value = 0.035 * volume;
  }, [volume]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("timeupdate", () => setElapsed(audio.currentTime));
    audio.addEventListener("ended", () => setPlaying(false));
    audio.addEventListener("error", () => {
      setPlaying(false);
      setSearchStatus("error");
      setSearchMessage("Audio is not cached yet. Search and add a playable result first.");
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
      synthRef.current?.oscillators.forEach((oscillator) => oscillator.stop());
      void synthRef.current?.context.close();
      synthRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeTrack || !audioRef.current) return;
    synthRef.current?.oscillators.forEach((oscillator) => oscillator.stop());
    void synthRef.current?.context.close();
    synthRef.current = null;
    if (activeTrack.streamUrl.startsWith("/audio/")) {
      audioRef.current.removeAttribute("src");
    } else {
      audioRef.current.src = apiUrl(activeTrack.streamUrl);
    }
    setElapsed(0);
  }, [activeTrack]);

  useEffect(() => {
    if (!activeTrack) return;
    if (activeTrack.streamUrl.startsWith("/audio/")) {
      if (!playing) {
        synthRef.current?.oscillators.forEach((oscillator) => oscillator.stop());
        void synthRef.current?.context.close();
        synthRef.current = null;
        return;
      }
      if (!synthRef.current) {
        const context = new AudioContext();
        const gain = context.createGain();
        gain.gain.value = 0.035 * volume;
        gain.connect(context.destination);
        const seed = activeTrack.artwork.label.charCodeAt(0);
        const oscillators = [0, 7, 12].map((offset, index) => {
          const oscillator = context.createOscillator();
          oscillator.type = index === 0 ? "sine" : "triangle";
          oscillator.frequency.value = 110 * 2 ** ((seed % 7 + offset) / 12);
          oscillator.connect(gain);
          oscillator.start();
          return oscillator;
        });
        synthRef.current = { context, oscillators, gain };
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      void audio.play().catch(() => {
        setPlaying(false);
        setSearchStatus("error");
        setSearchMessage("Playback was blocked or the audio source is unavailable.");
      });
    } else {
      audio.pause();
    }
  }, [playing, activeTrack]);

  useEffect(() => {
    if (!playing || !activeTrack?.streamUrl.startsWith("/audio/")) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => current >= activeTrack.durationSeconds ? 0 : current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, activeTrack]);

  if (!activeTrack) return null;
  const selectedTrack = activeTrack;

  function selectTrack(track: Track) {
    setActiveId(track.id);
    setElapsed(0);
    setPlaying(true);
  }

  function move(direction: number) {
    const sequence = queueTracks.length ? queueTracks : tracks;
    const current = sequence.findIndex((track) => track.id === selectedTrack.id);
    const next = (Math.max(current, 0) + direction + sequence.length) % sequence.length;
    const track = sequence[next];
    if (track) selectTrack(track);
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) {
      setSearchStatus("error");
      setSearchMessage("Type at least two characters.");
      return;
    }
    setSearchStatus("searching");
    setSearchMessage("");
    try {
      const results = await api.search(value);
      setSearchResults(results);
      setLocalSearchResults([]);
      setSearchStatus("idle");
      setSearchMessage(results.length ? `${results.length} YouTube Music results` : "No results");
    } catch (error) {
      const normalized = value.toLocaleLowerCase();
      const matches = tracks.filter((track) =>
        [track.title, track.artist, track.album].some((field) => field.toLocaleLowerCase().includes(normalized)));
      setSearchResults([]);
      setLocalSearchResults(matches);
      setSearchStatus(matches.length ? "idle" : "error");
      setSearchMessage(matches.length
        ? `API unavailable · ${matches.length} local result${matches.length === 1 ? "" : "s"}`
        : error instanceof Error ? error.message : "Search failed");
    }
  }

  async function importSearchResult(result: MediaSearchResult) {
    setSearchStatus("importing");
    setSearchMessage(`Caching “${result.title}”…`);
    try {
      const track = await api.importMedia(result);
      setTracks((current) => [track, ...current.filter((item) => item.id !== track.id)]);
      setActiveId(track.id);
      setSearchResults([]);
      setLocalSearchResults([]);
      setSearchStatus("idle");
      setSearchMessage("Ready to play");
      setPlaying(true);
    } catch (error) {
      setSearchStatus("error");
      setSearchMessage(error instanceof Error ? error.message : "Import failed");
    }
  }

  async function checkServer() {
    setSearchStatus("searching");
    setSearchMessage("Checking API…");
    try {
      const health = await api.health();
      setSearchStatus("idle");
      setSearchMessage(`Connected to ${health.service} ${health.version}`);
    } catch (error) {
      setSearchStatus("error");
      setSearchMessage(error instanceof Error ? error.message : "API connection failed");
    }
  }

  function toggleFavorite() {
    const next = new Set(favorites);
    if (next.has(selectedTrack.id)) next.delete(selectedTrack.id);
    else next.add(selectedTrack.id);
    setFavorites(next);
    localStorage.setItem("miusix:favorites", JSON.stringify([...next]));
  }

  function seek(value: number) {
    setElapsed(value);
    if (audioRef.current && !selectedTrack.streamUrl.startsWith("/audio/")) {
      audioRef.current.currentTime = value;
    }
  }

  function createPlaylist(title: string, trackId?: string) {
    const playlist: UserPlaylist = {
      id: crypto.randomUUID(),
      title,
      trackIds: trackId ? [trackId] : [],
    };
    setPlaylists((current) => [...current, playlist]);
    setPlaylistTrack(null);
  }

  function addToPlaylist(playlistId: string, trackId: string) {
    setPlaylists((current) => current.map((playlist) =>
      playlist.id === playlistId && !playlist.trackIds.includes(trackId)
        ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
        : playlist));
    setPlaylistTrack(null);
  }

  function queuePlaylist(playlist: UserPlaylist, playNow = false) {
    const validIds = playlist.trackIds.filter((id) => tracks.some((track) => track.id === id));
    setQueueIds((current) => [...current, ...validIds]);
    setSearchMessage(`${playlist.title}: ${validIds.length} tracks added to queue`);
    if (playNow) {
      const first = tracks.find((track) => track.id === validIds[0]);
      if (first) selectTrack(first);
    }
  }

  function changeView(mode: ViewMode) {
    setPlaying(false);
    const nextPath = mode === "ios" ? "/ios/" : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setViewMode(mode);
  }

  const sharedOverlays = (
    <>
      <PlaylistPicker
        track={playlistTrack}
        playlists={playlists}
        onClose={() => setPlaylistTrack(null)}
        onAdd={addToPlaylist}
        onCreate={createPlaylist}
      />
      <QueueDrawer
        open={queueOpen}
        tracks={queueTracks}
        onClose={() => setQueueOpen(false)}
        onPlay={selectTrack}
        onRemove={(trackId) => setQueueIds((current) => {
          const index = current.indexOf(trackId);
          return index < 0 ? current : current.filter((_, itemIndex) => itemIndex !== index);
        })}
        onClear={() => setQueueIds([])}
      />
    </>
  );

  if (viewMode === "ios") {
    return <EmbeddedIos onViewChange={changeView} />;
  }

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar">
        <a className="studio-brand" href="#" aria-label="Miusix home"><span>M</span><strong>MIUSIX</strong></a>
        <nav>
          <a className="is-active" href="#" aria-current="page"><span aria-hidden="true">⌂</span>Home</a>
          <a href="#discover"><span aria-hidden="true">⌕</span>Discover</a>
          <a href="#library"><span aria-hidden="true">▤</span>Library</a>
          <a href="#playlists"><span aria-hidden="true">♫</span>Playlists</a>
        </nav>
        <section className="studio-sidebar__playlists">
          <header><span>Your playlists</span><button type="button" onClick={() => document.getElementById("new-playlist-name")?.focus()}>＋</button></header>
          {playlists.map((playlist) => (
            <a href={`#playlist-${playlist.id}`} key={playlist.id}><i>♫</i><span>{playlist.title}</span><small>{playlist.trackIds.length}</small></a>
          ))}
          {playlists.length === 0 && <p>Create a playlist to shape your own listening room.</p>}
        </section>
        <div className="studio-profile"><span>SW</span><div><strong>Shuo Wang</strong><small>Personal library</small></div></div>
      </aside>

      <section className="studio-main">
        <header className="studio-topbar">
          <form className="studio-search" onSubmit={search}>
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search music" placeholder="Search YouTube Music" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" disabled={searchStatus === "searching"}>
              {searchStatus === "searching" ? (<><span className="spinner" aria-hidden="true" /> Searching</>) : "Search"}
            </button>
          </form>
          <div className="studio-topbar__actions">
            <ViewToggle value={viewMode} onChange={changeView} />
            <button className="studio-server" type="button" onClick={checkServer}>Check server</button>
          </div>
        </header>

        <div className="studio-content">
          {(searchResults.length > 0 || localSearchResults.length > 0 || searchStatus !== "idle") && (
            <section className="studio-search-results" aria-live="polite">
              <header>
                <div><span className="studio-kicker">YouTube Music</span><h2>Search results</h2></div>
                <span role="status" aria-live="polite">
                  {searchStatus === "importing" && <span className="spinner" aria-hidden="true" />} {searchMessage}
                </span>
              </header>
              {searchStatus === "error" && <p className="studio-error">{searchMessage}</p>}
              <div>
                {localSearchResults.map((track) => (
                  <article key={track.id}>
                    <button type="button" onClick={() => selectTrack(track)}><Artwork track={track} compact /><span><strong>{track.title}</strong><small>{track.artist}</small></span><time>{formatTime(track.durationSeconds)}</time></button>
                    <button type="button" aria-label={`Add ${track.title} to playlist`} onClick={() => setPlaylistTrack(track)}>＋</button>
                  </article>
                ))}
                {searchResults.map((result) => (
                  <article key={result.sourceId}>
                    <button type="button" disabled={searchStatus === "importing"} onClick={() => importSearchResult(result)}>
                      <img src={result.thumbnailUrl} alt="" /><span><strong>{result.title}</strong><small>{result.artist}</small></span><time>{formatTime(result.durationSeconds)}</time>
                    </button>
                    <span className="studio-result-action">Cache & play</span>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="studio-hero" id="discover">
            <div className="studio-hero__copy">
              <span className="studio-kicker">Artist spotlight · Adele</span>
              <h1>A voice that<br />fills the room.</h1>
              <p>Four essentials, surfaced from YouTube Music and ready to cache on your own server.</p>
              <div>
                <button type="button" onClick={() => importSearchResult(adelePicks[0]!)}>▶ Play Someone Like You</button>
                <a href="#adele-picks">Explore all</a>
              </div>
            </div>
            <button className="studio-hero__image" type="button" onClick={() => importSearchResult(adelePicks[0]!)} aria-label="Play Someone Like You by Adele">
              <img src={adelePicks[0]!.thumbnailUrl} alt="Adele in the Someone Like You music video" />
              <span><small>NOW FEATURED</small><strong>21</strong></span>
            </button>
          </section>

          <section className="studio-section" id="adele-picks">
            <header className="studio-section__heading">
              <div><span className="studio-kicker">From YouTube Music</span><h2>Adele essentials</h2></div>
              <span>Click a track to cache and play</span>
            </header>
            <div className="adele-grid">
              {adelePicks.map((pick, index) => (
                <button type="button" key={pick.sourceId} onClick={() => importSearchResult(pick)} disabled={searchStatus === "importing"}>
                  <span className="adele-grid__image"><img src={pick.thumbnailUrl} alt="" /><i>▶</i></span>
                  <span><small>0{index + 1}</small><strong>{pick.title}</strong><em>{pick.artist} · {formatTime(pick.durationSeconds)}</em></span>
                </button>
              ))}
            </div>
          </section>

          <section className="studio-section" id="library">
            <header className="studio-section__heading">
              <div><span className="studio-kicker">Available on this server</span><h2>Your library</h2></div>
              <span>{tracks.length} tracks</span>
            </header>
            <div className="studio-track-list">
              {tracks.map((track, index) => (
                <article className={track.id === activeTrack.id ? "is-active" : ""} key={track.id}>
                  <button className="studio-track-main" type="button" onClick={() => selectTrack(track)}>
                    <span className="studio-track-number">{(index + 1).toString().padStart(2, "0")}</span>
                    <Artwork track={track} compact />
                    <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                    <span className="studio-track-album">{track.album}</span>
                    <time>{formatTime(track.durationSeconds)}</time>
                  </button>
                  <button className="studio-track-like" type="button" aria-label={`Add ${track.title} to playlist`} onClick={() => setPlaylistTrack(track)}>＋</button>
                </article>
              ))}
            </div>
          </section>

          <section className="studio-section" id="playlists">
            <header className="studio-section__heading">
              <div><span className="studio-kicker">Saved in this browser</span><h2>Your playlists</h2></div>
              <span>One click adds every track to the queue</span>
            </header>
            <form
              className="studio-new-playlist"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newPlaylistName.trim()) return;
                createPlaylist(newPlaylistName.trim());
                setNewPlaylistName("");
              }}
            >
              <input id="new-playlist-name" aria-label="New playlist name" placeholder="Name a new playlist" value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.target.value)} />
              <button type="submit">Create playlist</button>
            </form>
            <div className="studio-playlist-grid">
              {playlists.map((playlist, index) => {
                const playlistTracks = playlist.trackIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track));
                return (
                  <article id={`playlist-${playlist.id}`} key={playlist.id}>
                    <div className={`studio-playlist-art tone-${index % 4}`}><span>♫</span><i /></div>
                    <div className="studio-playlist-meta"><span><strong>{playlist.title}</strong><small>{playlistTracks.length} tracks</small></span></div>
                    <div className="studio-playlist-actions">
                      <button type="button" disabled={playlistTracks.length === 0} onClick={() => queuePlaylist(playlist, true)}>▶ Play</button>
                      <button type="button" disabled={playlistTracks.length === 0} onClick={() => queuePlaylist(playlist)}>＋ Queue all</button>
                    </div>
                    <div className="studio-playlist-tracks">
                      {playlistTracks.slice(0, 3).map((track) => <button type="button" key={track.id} onClick={() => selectTrack(track)}>{track.title}<span>{formatTime(track.durationSeconds)}</span></button>)}
                      {playlistTracks.length === 0 && <p>Add music with the ＋ button beside any library track.</p>}
                    </div>
                  </article>
                );
              })}
              {playlists.length === 0 && <div className="studio-empty-playlists"><span>♫</span><strong>Your first playlist starts here.</strong><p>Create one above, then use the ＋ beside any track.</p></div>}
            </div>
          </section>

          <section className="studio-section studio-liked">
            <header className="studio-section__heading">
              <div><span className="studio-kicker">Quick collection</span><h2>Liked songs</h2></div><span>{favoriteTracks.length} saved</span>
            </header>
            {favoriteTracks.length === 0
              ? <button type="button" className="studio-liked__empty" onClick={toggleFavorite}>♡ Save the current track</button>
              : <div className="studio-liked__row">{favoriteTracks.map((track) => <button type="button" key={track.id} onClick={() => selectTrack(track)}><Artwork track={track} compact /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button>)}</div>}
          </section>
        </div>
      </section>

      <section className="studio-player" aria-label="Now playing">
        <div className="studio-now-playing">
          <Artwork track={activeTrack} compact />
          <span><strong>{activeTrack.title}</strong><small>{activeTrack.artist}</small></span>
          <button className={favorites.has(activeTrack.id) ? "is-liked" : ""} type="button" aria-label={favorites.has(activeTrack.id) ? "Remove from favorites" : "Add to favorites"} onClick={toggleFavorite}>{favorites.has(activeTrack.id) ? "♥" : "♡"}</button>
          <button type="button" aria-label={`Add ${activeTrack.title} to playlist`} onClick={() => setPlaylistTrack(activeTrack)}>＋</button>
        </div>
        <div className="studio-transport">
          <div><button type="button" onClick={() => move(-1)} aria-label="Previous track">◀</button><button type="button" className="studio-play" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button><button type="button" onClick={() => move(1)} aria-label="Next track">▶</button></div>
          <label><span>{formatTime(elapsed)}</span><input aria-label="Playback position" type="range" min="0" max={activeTrack.durationSeconds} value={Math.min(elapsed, activeTrack.durationSeconds)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(activeTrack.durationSeconds)}</span></label>
        </div>
        <div className="studio-player-tools">
          <button type="button" onClick={() => setQueueOpen(true)}>Queue <b>{queueIds.length}</b></button>
          <span aria-hidden="true">◖</span>
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
      </section>

      {sharedOverlays}
    </main>
  );
}
