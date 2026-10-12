# Miusix backend deployment

## Recommended shape

Run the backend on a small overseas Linux VPS or a machine you control:

```text
Vercel Web
    │ HTTPS
    ▼
Caddy / TLS
    ├── Fastify API
    ├── yt-dlp process
    ├── PostgreSQL
    └── persistent media volume
```

This workload needs a long-running process, an updatable yt-dlp binary, outbound
network access, and durable storage. It is not a good fit for a short-lived
serverless function.

For an early single-user deployment, start with:

- 1 shared vCPU
- 2 GB RAM
- 50–60 GB SSD
- Ubuntu 24.04 or another current Docker host
- daily database and media backups

DigitalOcean's current Basic 2 GB Droplet includes 50 GB SSD and 2,000 GiB
transfer for USD 12/month. AWS Lightsail offers a comparable 2 GB / 60 GB
bundle. Railway and Fly.io can run the container, but attached volumes have
platform-specific size, replication, and billing tradeoffs; a plain VPS is
simpler for the first media cache.

Choose a region that is close to the listeners and can reach the configured
provider. Before committing to a host, test provider search from that exact
machine: media sites may throttle or block data-center IP ranges.

## What belongs in PostgreSQL

Store identity and state in PostgreSQL—not the audio bytes:

| Field | Purpose |
| --- | --- |
| `id` | Stable internal Miusix UUID |
| `source_provider` | `local`, `youtube`, or a future provider |
| `external_id` | Provider identity, such as the 11-character YouTube ID |
| `source_url` | Canonical source reference |
| `media_path` | Relative disk path or object-storage key |
| `mime_type` | Correct response type for playback |
| `download_status` | `pending`, `ready`, or `failed` |
| track metadata | Title, artist, duration, artwork, explicit flag |

The unique pair `(source_provider, external_id)` prevents duplicate downloads.
The internal UUID keeps playlists and favorites stable if a provider changes.

Store the actual media in one of these places:

1. A mounted VPS/NAS volume for the simplest single-node deployment.
2. S3-compatible object storage once multiple API instances need the same
   library.

Do not store large media blobs in PostgreSQL. Database backups become slow and
expensive, range delivery is less natural, and storage scaling is coupled to
metadata scaling.

## Import lifecycle

The current MVP performs an import synchronously:

1. Search returns provider metadata.
2. The client submits a validated provider ID.
3. The API builds the source URL itself.
4. yt-dlp writes browser-compatible M4A or WebM audio to the media volume.
5. PostgreSQL records the final file key and marks the track ready.
6. The stream endpoint serves byte ranges.

Before opening the service to multiple users, move step 4 into a queue-backed
worker. Keep the API response fast, deduplicate concurrent jobs, cap duration
and file size, add per-user quotas, and record retry/error details.

## Environment

```dotenv
DATABASE_URL=postgres://miusix:strong-password@db:5432/miusix
MEDIA_ROOT=/data/media
WEB_ORIGIN=https://miusix.vercel.app,https://pre-miusix.vercel.app
ENABLE_YOUTUBE_IMPORTS=false
YT_DLP_PATH=yt-dlp
```

Enable provider imports only when the deployment is private and the operator
has confirmed that the content may be saved. The adapter validates provider
IDs and never accepts an arbitrary download URL.

## Production checklist

- Put the API behind HTTPS.
- Add authentication before enabling imports publicly.
- Keep imports disabled by default.
- Rate-limit search and import endpoints.
- Back up PostgreSQL and the media volume separately.
- Monitor free disk space.
- Update yt-dlp regularly.
- Add a queue before running more than one API instance.
- Rotate any credentials previously committed to repository history.

Relevant primary documentation:

- [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md)
- [YouTube Terms of Service](https://www.youtube.com/static?template=terms)
- [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets)
- [Railway persistent services](https://docs.railway.com/services)
- [Fly.io volumes](https://fly.io/docs/volumes/overview/)
