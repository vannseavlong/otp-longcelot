Embedded Example
================

This minimal example demonstrates mounting the auth service inside an existing Express app.

Prerequisites
-------------
- Build the project first so `dist/` exists:

  pnpm run build

- Ensure environment variables (see project root `.env.example`) are set for the example to use.

Run the example
---------------

From the repository root:

  pnpm run build
  node examples/embedded/app.mjs

The example will listen on port `4000` by default (set `EXAMPLE_PORT` to change).

Notes
-----
- The example imports from `dist/` so ensure the project is built before running.
- To embed via an installed package, import the library's exported `createApp` and adapters instead of `dist/` paths.
