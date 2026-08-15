# Alpine keeps the image small, which matters here mainly as attack surface: this container
# holds credentials to the production database.
FROM node:22-alpine

WORKDIR /app

# Copy manifests first so the dependency layer is cached independently of the source.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./

# Drop root. node:alpine ships a "node" user for exactly this.
USER node

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Container-level liveness, independent of Traefik's own checks, so a proxy that can start
# but cannot reach Postgres is reported unhealthy rather than silently serving 503s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
