import type { Attachment } from './chats';
import { isImage, compressImage, makeThumbnail } from '$lib/utils/image';
import { isVideo, compressVideo } from '$lib/utils/video';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** Max upload size in bytes — keep in sync with the backend limits. */
export const MAX_UPLOAD_SIZE = 26214400; // 25 MiB (general files)
export const MAX_VIDEO_SIZE = 157286400; // 150 MiB (video source cap)

/** Per-file upload progress: preparing/compressing, then uploading. */
export type UploadProgress = (phase: 'processing' | 'uploading', pct?: number) => void;

interface CreateUploadMeta {
	chat_id: number;
	filename: string;
	mime_type: string;
	size: number;
	width?: number;
	height?: number;
	thumbnail: boolean;
}

interface CreateUploadResp {
	attachment_id: number;
	upload_url: string;
	thumb_upload_url?: string;
}

/** Result of a completed upload. */
export interface UploadedAttachment {
	attachmentId: number;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	width?: number;
	height?: number;
}

async function createUpload(token: string, meta: CreateUploadMeta): Promise<CreateUploadResp> {
	const res = await fetch(`${API_BASE}/api/uploads`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(meta)
	});
	if (!res.ok) throw new Error('Failed to create upload');
	return res.json();
}

async function putToStorage(
	url: string,
	blob: Blob,
	contentType: string,
	signal?: AbortSignal
): Promise<void> {
	// Direct PUT to object storage — the presigned URL authorizes it, so no
	// Authorization header here (adding one would break the signature).
	const res = await fetch(url, {
		method: 'PUT',
		headers: { 'Content-Type': contentType },
		body: blob,
		signal
	});
	if (!res.ok) throw new Error('Failed to upload file to storage');
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
}

/**
 * Prepare (compress images), obtain a presigned URL, upload directly to storage,
 * and return the reserved attachment id plus metadata for optimistic display.
 */
export async function uploadFile(
	token: string,
	chatId: number,
	file: File,
	onProgress?: UploadProgress,
	signal?: AbortSignal
): Promise<UploadedAttachment> {
	let blob: Blob = file;
	let mimeType = file.type || 'application/octet-stream';
	let filename = file.name;
	let width: number | undefined;
	let height: number | undefined;
	let thumbBlob: Blob | undefined;

	if (isImage(file)) {
		const prepared = await compressImage(file);
		blob = prepared.blob;
		mimeType = prepared.mimeType;
		width = prepared.width || undefined;
		height = prepared.height || undefined;
		try {
			thumbBlob = await makeThumbnail(file);
		} catch {
			thumbBlob = undefined;
		}
	} else if (isVideo(file)) {
		const prepared = await compressVideo(file, onProgress);
		blob = prepared.blob;
		mimeType = prepared.mimeType;
		width = prepared.width || undefined;
		height = prepared.height || undefined;
		thumbBlob = prepared.poster;
		// Transcoded output is MP4 regardless of the source container.
		if (mimeType === 'video/mp4') filename = file.name.replace(/\.[^.]+$/, '') + '.mp4';
	}

	throwIfAborted(signal); // e.g. cancelled during video transcode
	onProgress?.('uploading');

	const res = await createUpload(token, {
		chat_id: chatId,
		filename,
		mime_type: mimeType,
		size: blob.size,
		width,
		height,
		thumbnail: !!thumbBlob
	});

	throwIfAborted(signal);
	await putToStorage(res.upload_url, blob, mimeType, signal);
	if (thumbBlob && res.thumb_upload_url) {
		await putToStorage(res.thumb_upload_url, thumbBlob, thumbBlob.type || 'image/jpeg', signal);
	}

	return {
		attachmentId: res.attachment_id,
		filename,
		mimeType,
		sizeBytes: blob.size,
		width,
		height
	};
}

/** Refresh presigned URLs for a single attachment (e.g. after link expiry). */
export async function getFile(token: string, id: number): Promise<Attachment> {
	const res = await fetch(`${API_BASE}/api/files/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Failed to fetch file');
	return res.json();
}
