create extension if not exists "pgcrypto";

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  album text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  artwork jsonb not null default '{"background":"#f25f3a","accent":"#111111","label":"MX"}',
  explicit boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists playlist_tracks (
  playlist_id uuid not null references playlists(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  position integer not null,
  primary key (playlist_id, track_id)
);
