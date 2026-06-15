# Deployment

Production deploy for the Lexora backend API. Same scheme as the `lexora`
frontend repo: **push to a `release-*` branch → GitHub Actions builds a Docker
image → pushes it to GHCR → scp's the prod compose to the server → ssh's in and
`docker compose pull && up -d`.**

## Topology

```
Browser (https://lexora.dockore.org)
        │  XHR with credentials, directly to the API host
        ▼
Cloudflare ──► server :443 ──► edge-nginx (Docker container)
                                   │  proxy_pass http://lexora-api:3010
                                   │  (over the shared `edge` Docker network)
                                   ▼
                              lexora-api  ──(internal network)──► lexora-postgres
                              (NestJS, :3010)                     (postgres:17, :5432)
```

- **One Ubuntu server.** Apps live in `/opt/apps/<name>`; this one in
  `/opt/apps/lexora-backend`.
- **Reverse proxy** is the `edge-nginx` container. Host site-configs live in
  `/opt/edge-nginx/conf.d/*.conf` (mounted into the container at
  `/etc/nginx/conf.d/`); `nginx.conf` does `include /etc/nginx/conf.d/*.conf`.
- **TLS**: Cloudflare in front + a wildcard `*.dockore.org` origin cert on the
  server, mounted in edge-nginx at `/etc/nginx/certs/origin.crt` / `.key`.
- edge-nginx reaches app containers **by container name** over a **shared Docker
  network**. Our `api` container joins that network (`edge`); Postgres does not.
- The frontend (`https://lexora.dockore.org`) calls this API **directly** at
  `https://lexora-backend.dockore.org`, so the vhost is public and CORS allows
  the frontend origin.

## What's in this repo

| File | Purpose |
|---|---|
| `.github/workflows/deploy.yml` | CI: build `ghcr.io/couldbefree/lexora-be`, push, scp compose + pg init, ssh deploy. Trigger: `release-*`. |
| `docker-compose.prod.yml` | Prod stack: `api` (no host ports, on `edge`+`internal`) + `postgres` (internal only). |
| `deploy/nginx/lexora-backend.dockore.org.conf` | edge-nginx vhost. Copy to `/opt/edge-nginx/conf.d/` on the server. |
| `Dockerfile` | Multi-stage build, `EXPOSE 3010`, runs `node dist/main`. |
| `.dockerignore` | Keeps `node_modules`, `dist`, `.env`, `.git`, etc. out of the build context. |
| `docker/postgres/init/01-init.sql` | Enables `uuid-ossp` + `pgcrypto` on first DB boot (TypeORM `synchronize` needs `uuid_generate_v4()`). |

### Deploy target summary

- Image: `ghcr.io/couldbefree/lexora-be`
- Server dir: `/opt/apps/lexora-backend`
- Container: `lexora-api`, listens on **3010** (not published to the host)
- Postgres container: `lexora-postgres`, internal only, never published
- Public URL: `https://lexora-backend.dockore.org`
- Deploy branch: `release-1.0` (any `release-*` works)

## Server `.env`

Create `/opt/apps/lexora-backend/.env` **before the first deploy** (the ssh
script runs `grep` on it with `script_stop: true`, so a missing file fails the
job). It is **never committed**. CI keeps `BACKEND_IMAGE_TAG` and
`GITHUB_REPOSITORY_OWNER` in sync on each run; you set the rest once.

```dotenv
# ── Deploy / image (used by docker compose interpolation) ──
GITHUB_REPOSITORY_OWNER=couldbefree
EDGE_NETWORK=<see "Determine EDGE_NETWORK" below>
BACKEND_IMAGE_TAG=bootstrap            # CI overwrites this on every deploy

# ── App ──
NODE_ENV=production                     # enables `secure` flag on lx_session cookie
PORT=3010
FRONTEND_URL=https://lexora.dockore.org # CORS origin (credentials: true)
JWT_SECRET=<strong random string>      # MUST set — code falls back to 'fallback_secret' otherwise

# ── Postgres (the bundled container) ──
POSTGRES_DB=lexora
POSTGRES_USER=lexora
POSTGRES_PASSWORD=<strong random password>

# ── Google OAuth ──
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>
GOOGLE_CALLBACK_URL=https://lexora-backend.dockore.org/auth/google/callback

# ── AI ──
ANTHROPIC_API_KEY=<...>
```

Notes:
- **`POSTGRES_HOST` / `POSTGRES_PORT` are NOT in `.env`** — `docker-compose.prod.yml`
  sets them to `postgres` / `5432` in the api service's `environment:` block
  (overriding the code default of `localhost:5434`).
- `JWT_SECRET` and `GOOGLE_CALLBACK_URL` aren't in the task's env list but are
  read by `src` (`auth.module.ts` / `jwt.strategy.ts` and `google.strategy.ts`)
  and have localhost/fallback defaults, so they **must** be set for prod.
- Generate secrets with e.g. `openssl rand -hex 32`.

### Determine `EDGE_NETWORK`

The name of the Docker network edge-nginx is attached to (so `api` can join it):

```bash
docker inspect edge-nginx -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

Put that value in `EDGE_NETWORK`. The compose `edge` network is declared
`external: true, name: ${EDGE_NETWORK}` — Compose attaches to the existing
network rather than creating one.

## One-time manual setup

Do these once, in order, before deploying:

1. **GitHub secrets** — in *this* repo's Settings → Secrets and variables →
   Actions, add the same values the frontend uses (same server):
   `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` (private SSH key whose public
   half is already in that user's `authorized_keys`). `GITHUB_TOKEN` is
   automatic.
2. **Server dir + `.env`** — create them before the first deploy:
   ```bash
   mkdir -p /opt/apps/lexora-backend
   vi /opt/apps/lexora-backend/.env     # contents from "Server .env" above
   ```
   (The `docker/postgres/init` dir and `docker-compose.prod.yml` are scp'd by CI.)
3. **First CI run** — push `release-1.0`. After it completes, make the GHCR
   package `lexora-be` **Public** (GitHub → your packages → lexora-be → Package
   settings → Change visibility → Public). Alternatively, log Docker in on the
   server with a PAT that has `read:packages` so the private pull works.
4. **nginx vhost** — copy the vhost into edge-nginx's config dir and reload:
   ```bash
   scp deploy/nginx/lexora-backend.dockore.org.conf \
       <user>@<server>:/opt/edge-nginx/conf.d/
   docker exec -it edge-nginx nginx -t
   docker exec -it edge-nginx nginx -s reload
   ```
5. **DNS** — `lexora-backend.dockore.org` A-record → server. *(Already created.)*

## Deploying

Push to a `release-*` branch:

```bash
git checkout -b release-1.0
git push -u origin release-1.0
```

The workflow then, on the server, in `/opt/apps/lexora-backend`:
`docker login ghcr.io` → update `BACKEND_IMAGE_TAG` in `.env` →
`docker compose -f docker-compose.prod.yml pull api` →
`docker compose -f docker-compose.prod.yml up -d` (whole stack, so Postgres
comes up too) → `docker image prune -f`.

On first boot, Postgres runs `01-init.sql` (extensions) and TypeORM
`synchronize: true` creates the schema automatically — no migration runner
needed for a clean database.

## Verify

```bash
# From anywhere — public endpoint via Cloudflare → edge-nginx → api
curl -I https://lexora-backend.dockore.org

# On the server
docker ps                       # lexora-api + lexora-postgres both Up (postgres healthy)
docker logs lexora-api          # "🚀 Server running on ... 3010"
docker logs lexora-postgres

# Confirm api joined the edge network (so nginx can resolve `lexora-api`)
docker inspect lexora-api -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'

# Confirm Postgres is NOT published to the host (should print nothing)
docker port lexora-postgres
```

A CORS check from the browser console on `https://lexora.dockore.org`:

```js
fetch('https://lexora-backend.dockore.org/auth/me', { credentials: 'include' })
```

## Notes / gotchas

- **`synchronize: true`** is on — schema is auto-created on first start; fine for
  a clean DB. No separate migration runner.
- The `lx_session` cookie is `SameSite=Lax` + `secure` in prod, no `domain`, so
  it works across `*.dockore.org` subdomains (same-site). Auth/cookie code is
  unchanged — only env (`NODE_ENV=production`, `FRONTEND_URL`) drives behavior.
- **Never publish Postgres** to the host, and keep only `api` on the `edge`
  network.
- **Never commit `.env`** or any secret.
