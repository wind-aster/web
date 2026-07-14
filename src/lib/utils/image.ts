// Client-side image preparation: downscale + re-encode large images before
// upload, and generate a small inline thumbnail. Non-image files are left
// untouched by callers. Zero-dependency (Canvas / createImageBitmap).

export interface PreparedImage {
	blob: Blob;
	mimeType: string;
	width: number;
	height: number;
}

export function isImage(file: File): boolean {
	return file.type.startsWith('image/');
}

/** True for formats we should not re-encode (animated / vector / already-small-loss). */
function skipReencode(mime: string): boolean {
	return mime === 'image/gif' || mime === 'image/svg+xml';
}

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
	return await createImageBitmap(file);
}

function scaledSize(w: number, h: number, maxDim: number): [number, number] {
	if (w <= maxDim && h <= maxDim) return [w, h];
	const ratio = Math.min(maxDim / w, maxDim / h);
	return [Math.round(w * ratio), Math.round(h * ratio)];
}

async function encode(
	bitmap: ImageBitmap,
	w: number,
	h: number,
	quality: number
): Promise<{ blob: Blob; mimeType: string }> {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');
	ctx.drawImage(bitmap, 0, 0, w, h);

	const toBlob = (type: string): Promise<Blob | null> =>
		new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

	// Prefer WebP; fall back to JPEG if the browser can't encode it.
	let blob = await toBlob('image/webp');
	let mimeType = 'image/webp';
	if (!blob || blob.type !== 'image/webp') {
		blob = await toBlob('image/jpeg');
		mimeType = 'image/jpeg';
	}
	if (!blob) throw new Error('Image encoding failed');
	return { blob, mimeType };
}

/**
 * Compress/downscale an image. Returns the original (as a Blob) unchanged for
 * formats we shouldn't re-encode. `maxDim` caps the longest edge.
 */
export async function compressImage(
	file: File,
	maxDim = 1920,
	quality = 0.8
): Promise<PreparedImage> {
	if (skipReencode(file.type)) {
		const bmp = await loadBitmap(file).catch(() => null);
		return {
			blob: file,
			mimeType: file.type,
			width: bmp?.width ?? 0,
			height: bmp?.height ?? 0
		};
	}

	const bitmap = await loadBitmap(file);
	const [w, h] = scaledSize(bitmap.width, bitmap.height, maxDim);
	const { blob, mimeType } = await encode(bitmap, w, h, quality);
	bitmap.close();

	// If re-encoding somehow produced a larger file at full size, keep the original.
	if (w === bitmap.width && h === bitmap.height && blob.size >= file.size) {
		return { blob: file, mimeType: file.type, width: w, height: h };
	}
	return { blob, mimeType, width: w, height: h };
}

/** Generate a small thumbnail Blob (WebP/JPEG) for inline preview. */
export async function makeThumbnail(file: File, maxDim = 320): Promise<Blob> {
	const bitmap = await loadBitmap(file);
	const [w, h] = scaledSize(bitmap.width, bitmap.height, maxDim);
	const { blob } = await encode(bitmap, w, h, 0.7);
	bitmap.close();
	return blob;
}
