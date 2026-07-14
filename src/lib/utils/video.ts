// Client-side video preparation with ffmpeg.wasm: transcode/downscale to ~720p
// H.264/AAC MP4 before upload and grab a poster frame. Mirrors utils/image.ts.
//
// The ffmpeg core is self-hosted from /static/ffmpeg (never a CDN — see the
// zero-cloud-dependency rule) and is the single-threaded build, so no
// SharedArrayBuffer / COOP+COEP headers are required (which would otherwise
// break our cross-origin MinIO media).
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface PreparedVideo {
	blob: Blob;
	mimeType: string; // 'video/mp4' when transcoded, else the source type
	width: number;
	height: number;
	poster?: Blob;
}

export type VideoProgress = (phase: 'processing', pct: number) => void;

export function isVideo(file: File): boolean {
	return file.type.startsWith('video/');
}

// ffmpeg's readFile returns a Uint8Array typed over ArrayBufferLike (possibly a
// SharedArrayBuffer), which isn't a valid BlobPart. Copy into a plain
// ArrayBuffer-backed array so it can go straight into a Blob.
function toBlobPart(data: Uint8Array): BlobPart {
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	return copy;
}

const CORE_BASE = '/ffmpeg';

let ffmpegPromise: Promise<FFmpeg> | null = null;

/** Lazily load the ffmpeg.wasm core (multi-MB) — only when first needed. */
function loadFFmpeg(): Promise<FFmpeg> {
	if (!ffmpegPromise) {
		ffmpegPromise = (async () => {
			const ffmpeg = new FFmpeg();
			await ffmpeg.load({
				coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
				wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
			});
			return ffmpeg;
		})().catch((err) => {
			ffmpegPromise = null; // allow a retry on next attempt
			throw err;
		});
	}
	return ffmpegPromise;
}

/** Read intrinsic dimensions from a video blob via a throwaway <video>. */
function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(blob);
		const video = document.createElement('video');
		video.preload = 'metadata';
		video.muted = true;
		const done = (width: number, height: number) => {
			URL.revokeObjectURL(url);
			resolve({ width, height });
		};
		video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight);
		video.onerror = () => done(0, 0);
		video.src = url;
	});
}

/** Fallback poster grabbed in-browser from the first decodable frame. */
function posterFromVideo(file: File): Promise<Blob | undefined> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const video = document.createElement('video');
		video.preload = 'metadata';
		video.muted = true;
		const cleanup = () => URL.revokeObjectURL(url);
		video.onloadeddata = () => {
			try {
				const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight || 1));
				const canvas = document.createElement('canvas');
				canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
				canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					cleanup();
					return resolve(undefined);
				}
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
				canvas.toBlob(
					(b) => {
						cleanup();
						resolve(b ?? undefined);
					},
					'image/jpeg',
					0.7
				);
			} catch {
				cleanup();
				resolve(undefined);
			}
		};
		video.onerror = () => {
			cleanup();
			resolve(undefined);
		};
		video.src = url;
	});
}

/**
 * Transcode a video to 720p-ish H.264/AAC MP4 and produce a poster frame.
 * On any ffmpeg failure, falls back to the original file plus a best-effort
 * Canvas poster so the user is never blocked.
 */
export async function compressVideo(
	file: File,
	onProgress?: VideoProgress
): Promise<PreparedVideo> {
	try {
		const ffmpeg = await loadFFmpeg();

		const progress = ({ progress }: { progress: number }) => {
			if (onProgress)
				onProgress('processing', Math.max(0, Math.min(100, Math.round(progress * 100))));
		};
		ffmpeg.on('progress', progress);

		try {
			await ffmpeg.writeFile('in', await fetchFile(file));
			await ffmpeg.exec([
				'-i',
				'in',
				'-vf',
				"scale='min(1280,iw)':-2",
				'-c:v',
				'libx264',
				'-preset',
				'veryfast',
				'-crf',
				'28',
				'-c:a',
				'aac',
				'-b:a',
				'128k',
				'-movflags',
				'+faststart',
				'out.mp4'
			]);
			const outData = (await ffmpeg.readFile('out.mp4')) as Uint8Array;
			const blob = new Blob([toBlobPart(outData)], { type: 'video/mp4' });

			let poster: Blob | undefined;
			try {
				await ffmpeg.exec(['-i', 'in', '-frames:v', '1', '-vf', 'scale=320:-2', 'poster.jpg']);
				const posterData = (await ffmpeg.readFile('poster.jpg')) as Uint8Array;
				poster = new Blob([toBlobPart(posterData)], { type: 'image/jpeg' });
			} catch {
				poster = undefined;
			}

			const { width, height } = await readDimensions(blob);
			return { blob, mimeType: 'video/mp4', width, height, poster };
		} finally {
			ffmpeg.off('progress', progress);
			// Best-effort cleanup of the virtual FS.
			await ffmpeg.deleteFile('in').catch(() => {});
			await ffmpeg.deleteFile('out.mp4').catch(() => {});
			await ffmpeg.deleteFile('poster.jpg').catch(() => {});
		}
	} catch (err) {
		console.warn('Video transcode failed, uploading original', err);
		const { width, height } = await readDimensions(file);
		const poster = await posterFromVideo(file);
		return {
			blob: file,
			mimeType: file.type || 'video/mp4',
			width,
			height,
			poster
		};
	}
}
