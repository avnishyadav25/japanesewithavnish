# VPS: app Postgres + HTTPS SQL proxy

Phase 2 of the database consolidation. Runs the app's own PostgreSQL 17 and an
authenticated HTTPS SQL proxy on the Hostinger VPS, alongside the existing n8n/Traefik
stack.

## Why a proxy instead of exposing Postgres

Netlify Functions have no static egress IPs, so IP-allowlisting is impossible — a Postgres
port would have to accept the whole internet. Instead Postgres stays on a private Docker
network and Traefik routes TLS to a small authenticated service. Because
[`src/lib/db/pg-shim.ts`](../src/lib/db/pg-shim.ts) already abstracts the driver to
`query(text, params)`, this drops in where the Neon HTTP driver sits today.

It also batches: several statements per round trip, which matters at ~230 ms from Netlify's
region to Mumbai.

## What it deliberately does not do

- **Does not touch `shared-postgres`.** That container is postgres:16; the primary being
  migrated from is 17.10, and `pg_restore` refuses archives from a newer major version. The
  app gets its own 17.x instance on port 5433. Rollback is `docker compose down`.
- **Does not publish a proxy port.** Only Traefik can reach it.
- **Does not start without a token.** A proxy that fails open would serve the production
  database to anyone who found the hostname.

## Prerequisites

1. `api.japanesewithavnish.com` A record → the VPS IP. Traefik uses the **TLS-ALPN-01**
   challenge (`--certificatesresolvers.mytlschallenge.acme.tlschallenge=true`), which
   validates on :443, so no HTTP-01 webroot is needed.
2. The `n8n_default` Docker network exists (it does — Traefik lives there).
3. Swap. The host has none, so memory pressure OOM-kills rather than degrades:
   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

## Setup

```bash
mkdir -p /opt/jwa && cd /opt/jwa
# copy vps/docker-compose.yml and vps/db-proxy/ here

cat > .env <<EOF
PGUSER=jwa_app
PGPASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
PGDATABASE=japanesewithavnish
DB_PROXY_TOKEN=$(openssl rand -hex 32)
EOF
chmod 600 .env

docker compose up -d --build
docker compose ps
```

Verify, in order — each step isolates a different failure:

```bash
# 1. proxy is alive and can reach Postgres (from the host, bypassing Traefik)
docker exec jwa-db-proxy node -e "fetch('http://127.0.0.1:8080/health').then(r=>r.json()).then(console.log)"

# 2. Traefik issued a certificate and routes the hostname
curl -sS https://api.japanesewithavnish.com/health

# 3. auth is enforced
curl -sS -o /dev/null -w '%{http_code}\n' https://api.japanesewithavnish.com/query   # expect 401

# 4. a real query round trip
source .env
curl -sS -X POST https://api.japanesewithavnish.com/query \
  -H "Authorization: Bearer $DB_PROXY_TOKEN" -H 'content-type: application/json' \
  -d '{"statements":[{"sql":"select version()"}]}'
```

If step 2 fails but step 1 succeeds, it is DNS or the cert resolver name — check
`docker logs n8n-traefik-1` for ACME errors.

## API

| method | path | body | purpose |
|---|---|---|---|
| GET | `/health` | — | liveness; unauthenticated, reveals only reachability |
| POST | `/query` | `{statements:[{sql,params}], transaction?:bool}` | batch; `transaction:true` wraps in BEGIN/COMMIT |
| POST | `/tx/begin` | — | → `{txId}` for multi-round-trip transactions |
| POST | `/tx/query` | `{txId, statements}` | statements inside an open transaction |
| POST | `/tx/commit` / `/tx/rollback` | `{txId}` | finish it |

All except `/health` require `Authorization: Bearer $DB_PROXY_TOKEN`.

`/query` covers almost everything. The `/tx/*` session exists because `PgDriver.transaction(fn)`
takes a callback that can branch on intermediate results, which cannot be expressed as one
batched request. Sessions are reaped after 30s idle so a client dying mid-transaction cannot
permanently leak a pooled connection.

## Operational notes

- Both containers have memory limits; the host has 2 vCPU and no swap by default.
- Postgres is on `127.0.0.1:5433` for `psql`/`pg_dump` over an SSH tunnel. It is **not** how
  the proxy connects — that goes over the private `jwa-internal` network.
- Rotating `DB_PROXY_TOKEN` means updating `.env` here **and** in Netlify, then
  `docker compose up -d`. Doing only one side produces 401s that look like an outage.
