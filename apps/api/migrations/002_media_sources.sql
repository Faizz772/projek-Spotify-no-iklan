alter table tracks
  add column if not exists source_provider text not null default 'local',
  add column if not exists external_id text,
  add column if not exists source_url text,
  add column if not exists media_path text,
  add column if not exists mime_type text,
  add column if not exists download_status text not null default 'ready';

create unique index if not exists tracks_source_identity
  on tracks (source_provider, external_id)
  where external_id is not null;

alter table tracks
  drop constraint if exists tracks_download_status_check;

alter table tracks
  add constraint tracks_download_status_check
  check (download_status in ('pending', 'ready', 'failed'));
