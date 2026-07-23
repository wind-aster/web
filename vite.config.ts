import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: true,
		proxy: {
			'/api': {
				// IPv4 loopback (not `localhost`) so the WS upgrade never resolves to
				// `::1` first and hang — avoids `ws proxy error ETIMEDOUT`.
				target: 'http://127.0.0.1:8080',
				ws: true
			}
		}
	},
	// ffmpeg.wasm ships its own worker/wasm; pre-bundling breaks its internal
	// worker URL resolution, so leave these to be loaded as-is.
	optimizeDeps: {
		exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
	},
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	]
});
