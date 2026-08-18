// =============================================================================
//  VITE PRODUCTION BUILD CONFIG
// =============================================================================
//  The production bundle is INSTANCE-AGNOSTIC: one build serves every instance.
//  The server endpoint is NOT baked in — it is fetched at runtime from
//  /config.json, which the client container's entrypoint renders from the
//  environment it was started with (see docker-entrypoint.d/).
//
//  VITE_SERVER_* remain available as a build-time FALLBACK for the case where
//  config.json cannot be loaded, but leaving them empty is the correct choice
//  for multi-instance deployment: a baked-in host makes the image
//  instance-specific and forces one build per instance.
// =============================================================================
import { defineConfig } from 'vite';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            
            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    // NOTE: no `server` block. This config only ever runs `vite build`, so a
    // dev-server port here was dead config — and the literal 8080 it carried
    // collided conceptually with the GAME server's port, which is a genuinely
    // confusing thing to leave lying around in a multi-instance setup.
    // Dev-server settings live in config.dev.mjs.
    plugins: [
        phasermsg()
    ]
});
