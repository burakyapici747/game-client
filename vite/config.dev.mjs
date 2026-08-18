// =============================================================================
//  VITE DEV CONFIG
// =============================================================================
//  No port literal lives here. The dev server's port and the game server
//  endpoint both come from the environment, so a developer can run several
//  client dev servers side by side the same way the Docker instances do.
//
//  Read from .env / .env.local in the project root (see .env.example):
//    CLIENT_DEV_PORT     port this dev server binds        (default: Vite's own)
//    VITE_SERVER_HOST    game server host  -> exposed to the bundle
//    VITE_SERVER_PORT    game server port  -> exposed to the bundle
//    VITE_SERVER_SCHEME  ws | wss
//    VITE_SERVER_PATH    WebSocket path
//
//  Only VITE_*-prefixed vars reach the bundle; CLIENT_DEV_PORT is build-tooling
//  config and is loaded with an explicit empty prefix so it stays server-side.
// =============================================================================
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // '' as the prefix loads EVERY var, not just VITE_* — needed because the
    // dev server port is tooling config, not something the bundle should see.
    const env = loadEnv(mode, process.cwd(), '');

    // Undefined (rather than a literal fallback) makes Vite pick its own
    // default. Inventing a port here would be exactly the kind of hardcoding
    // the multi-instance model has to avoid.
    const devPort = env.CLIENT_DEV_PORT ? Number(env.CLIENT_DEV_PORT) : undefined;

    return {
        base: './',
        build: {
            rollupOptions: {
                output: { manualChunks: { phaser: ['phaser'] } }
            }
        },
        server: {
            host: true,          // 0.0.0.0 — reachable from a phone on the LAN
            port: devPort,
            // Fail loudly instead of silently drifting to port+1: a silent
            // shift would leave the developer looking at a different instance
            // than the one they think they started.
            strictPort: devPort !== undefined,
        }
    };
});
