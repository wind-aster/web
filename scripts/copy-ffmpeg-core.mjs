// Vendors the single-threaded @ffmpeg/core into static/ffmpeg so the wasm is
// served same-origin (never from a CDN — see the zero-cloud-dependency rule).
// Runs on postinstall; safe to run repeatedly.
import { mkdir, copyFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(root, 'node_modules/@ffmpeg/core/dist/umd');
const outDir = resolve(root, 'static/ffmpeg');
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

try {
	await access(resolve(srcDir, files[0]));
} catch {
	console.warn('[copy-ffmpeg-core] @ffmpeg/core not found, skipping');
	process.exit(0);
}

await mkdir(outDir, { recursive: true });
for (const f of files) {
	await copyFile(resolve(srcDir, f), resolve(outDir, f));
}
console.log('[copy-ffmpeg-core] vendored ffmpeg core -> static/ffmpeg');
