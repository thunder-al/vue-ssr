FROM node:22-slim AS builder

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm \
    set -xe; \
    npm install --global pnpm;

COPY package.json pnpm-lock.yaml /app/

RUN --mount=type=cache,target=/root/.local/share \
    set -xe; \
    pnpm install; \
    pnpm install --frozen-lockfile;

COPY . /app

RUN --mount=type=cache,target=/root/.local/share \
    set -xe; \
    pnpm build;

RUN --mount=type=cache,target=/root/.local/share \
    set -xe; \
    pnpm prune --prod;

FROM node:22-slim AS server

WORKDIR /app

COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist

CMD node dist/server/index.js
