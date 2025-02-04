# Clean Vue SSR

Most clear implementation of Vue SSR and hybrid SSG using Vue 3 and vite

## Features

* Minimal amount of dependencies: only essential packages are used
* Fully separated client and server code base
* [Hono](https://hono.dev/) is used as a server and can be easily replaced with any other server
* Simple and clear SSR implementation (WIP)
* Hybrid SSG implementation (WIP)
* Closed server call of SSR and SSG axios/fetch data fetching. All SSR and SSG data fetching will call a server route directly bypassing http layer (WIP)
* Implementation of the `useData` hook for unified data fetching in SPA, SSR and SSG modes (WIP)
* Server side HMR (WIP)

## Usage

### Development

To run the project in development mode, run the following commands:

```bash
pnpm i
pnpm dev
```

It will bundle server in development mode, run it and restart on any backend changes.

Server will run vite dev server in it and bindle client code on the fly using vite dev server as middleware which is also supports HMR and live reload.

### Production (SSR)

WIP

### Production (SSG)

WIP

## FAQ

### Why not Nuxt.js?

Nuxt is huge framework with a lot of features that you may not need and rely on a lot of dependencies.
Also, in reality it turns out to be quite slow.
This project is a minimalistic implementation of Vue SSR and SSG that can be easily extended and customized.

### Why bundling server?

Running server without bundling requires ts-node which is slow, not recommended for production or using different than NodeJs runtime (deno, bun, etc).
In addition bundling eliminates dead code, optimizes some parts of the code and allows to use any compile time transformations.

### Why not `@hono/vite-build`?

Current implementation waiting for vite to build server bundle and runs it in a separate process.
This approach is more flexible and allows to use any server library/framework, also its isolates bundler runtime from server one.
