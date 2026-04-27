FROM oven/bun:1.2.18-debian AS install

WORKDIR /app

# Node is needed for the frontend build: React Router's vite plugin imports
# renderToPipeableStream from react-dom/server, which Bun resolves to server.bun.js
# (no such export). Bun is still used for the install (lockfile) and runtime.
COPY --from=node:20-bookworm-slim /usr/local/bin/node /usr/local/bin/node

# Copy lockfile and package manifests first for layer caching
COPY bun.lock package.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json

# Install from lockfile — fails if lockfile is out of sync (supply-chain safety)
RUN bun install --frozen-lockfile

COPY . .

# Backend runs from TS source under Bun (no build step). Only the frontend (React Router 7) needs a build.
RUN cd packages/frontend && node /app/node_modules/.bin/react-router build

# release image
FROM oven/bun:1.2.18-debian AS release
WORKDIR /app
ENV NODE_ENV=production

# Hoisted workspace deps + root manifest
COPY --from=install /app/node_modules /app/node_modules
COPY --from=install /app/package.json /app/package.json

# Backend: TS source (Bun runs source directly, no compiled artifact)
COPY --from=install /app/packages/backend/package.json /app/packages/backend/package.json
COPY --from=install /app/packages/backend/src /app/packages/backend/src

# Frontend: SPA bundle (served as static files by the backend)
COPY --from=install /app/packages/frontend/build/client /app/packages/frontend/build/client

EXPOSE 5000
CMD ["bun", "run", "packages/backend/src/index.ts"]
