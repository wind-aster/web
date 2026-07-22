<script lang="ts">
	import { TextField } from 'svelte-fluentui';
	import { chat } from '$lib/stores/chat.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { uploadFile, MAX_UPLOAD_SIZE, MAX_VIDEO_SIZE } from '$lib/api/uploads';
	import { isVideo } from '$lib/utils/video';
	import { formatBytes } from '$lib/utils/format';
	import { toast } from '$lib/stores/toast.svelte';

	interface Pending {
		uid: number;
		filename: string;
		sizeBytes: number;
		status: 'uploading' | 'done' | 'error';
		phase?: 'processing' | 'uploading';
		progress?: number;
		attachmentId?: number;
		previewUrl?: string; // local object URL for images
		controller?: AbortController;
	}

	let inputText = $state('');
	let pending = $state<Pending[]>([]);
	let fileInput = $state<HTMLInputElement | null>(null);
	let dragActive = $state(false);
	let uid = 0;

	const uploading = $derived(pending.some((p) => p.status === 'uploading'));
	const ready = $derived(pending.filter((p) => p.status === 'done'));
	const isEditing = $derived(chat.editingId !== null);
	const canSend = $derived(
		isEditing
			? inputText.trim().length > 0
			: !uploading && (inputText.trim().length > 0 || ready.length > 0)
	);

	// Prefill the input when entering edit mode; clear it when leaving (submit/cancel).
	let wasEditing = false;
	$effect(() => {
		const editing = chat.editingId !== null;
		if (editing && !wasEditing) {
			inputText = chat.editingText;
		} else if (!editing && wasEditing) {
			inputText = '';
		}
		wasEditing = editing;
	});

	function pickFiles() {
		fileInput?.click();
	}

	function handleFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = ''; // allow re-selecting the same file
		addFiles(files);
	}

	// Accept images from the clipboard (e.g. a pasted screenshot). Falls through
	// for non-image pastes so normal text paste keeps working.
	function handlePaste(e: ClipboardEvent) {
		const items = Array.from(e.clipboardData?.items ?? []);
		const images: File[] = [];
		for (const item of items) {
			if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
			const file = item.getAsFile();
			if (!file) continue;
			// Pasted images usually arrive as a generic "image.png"/empty name.
			if (!file.name || file.name === 'image.png') {
				const ext = file.type.split('/')[1] || 'png';
				images.push(new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type }));
			} else {
				images.push(file);
			}
		}
		if (images.length === 0) return;
		e.preventDefault();
		addFiles(images);
	}

	function addFiles(files: File[]) {
		const chatId = chat.selectedChatId;
		if (chatId === null || !auth.token || isEditing) return;

		for (const file of files) {
			const cap = isVideo(file) ? MAX_VIDEO_SIZE : MAX_UPLOAD_SIZE;
			if (file.size > cap) {
				toast.error(
					`"${file.name}" is ${formatBytes(file.size)} — over the ${formatBytes(cap)} limit.`
				);
				continue;
			}
			const controller = new AbortController();
			const entry: Pending = {
				uid: uid++,
				filename: file.name,
				sizeBytes: file.size,
				status: 'uploading',
				phase: isVideo(file) ? 'processing' : 'uploading',
				progress: 0,
				previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
				controller
			};
			pending = [...pending, entry];

			const onProgress = (phase: 'processing' | 'uploading', pct?: number) => {
				pending = pending.map((p) =>
					p.uid === entry.uid ? { ...p, phase, progress: pct ?? p.progress } : p
				);
			};

			uploadFile(chatId, file, onProgress, controller.signal)
				.then((res) => {
					pending = pending.map((p) =>
						p.uid === entry.uid ? { ...p, status: 'done', attachmentId: res.attachmentId } : p
					);
				})
				.catch((err) => {
					if (err?.name === 'AbortError') return; // cancelled — chip already removed
					console.error('Upload failed', err);
					toast.error(`Couldn't upload "${file.name}"`);
					pending = pending.map((p) => (p.uid === entry.uid ? { ...p, status: 'error' } : p));
				});
		}
	}

	function removePending(uidToRemove: number) {
		const entry = pending.find((p) => p.uid === uidToRemove);
		if (entry?.status === 'uploading') entry.controller?.abort();
		if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
		pending = pending.filter((p) => p.uid !== uidToRemove);
	}

	// Drag & drop anywhere over the open chat drops files into the composer.
	function hasFiles(e: DragEvent): boolean {
		return Array.from(e.dataTransfer?.types ?? []).includes('Files');
	}

	function onWindowDragOver(e: DragEvent) {
		if (chat.selectedChatId === null || !hasFiles(e)) return;
		e.preventDefault();
		dragActive = true;
	}

	function onWindowDragLeave(e: DragEvent) {
		// Only clear when the drag actually leaves the window.
		if (e.relatedTarget === null) dragActive = false;
	}

	function onWindowDrop(e: DragEvent) {
		if (chat.selectedChatId === null || !hasFiles(e)) return;
		e.preventDefault();
		dragActive = false;
		addFiles(Array.from(e.dataTransfer?.files ?? []));
	}

	function clearPending() {
		for (const p of pending) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
		pending = [];
	}

	async function send() {
		// Edit mode: submit the edit instead of sending a new message.
		if (isEditing) {
			await chat.submitEdit(inputText); // input cleared by the edit-mode effect
			return;
		}

		const text = inputText.trim();
		const ids = ready.map((p) => p.attachmentId!).filter((id) => id !== undefined);
		if (!text && ids.length === 0) return;
		if (uploading) return;

		if (await chat.sendMessage(text, ids, chat.replyingTo?.id)) {
			inputText = '';
			clearPending();
			chat.cancelReply();
			chat.stopTyping();
		}
	}

	// Display name of the message currently being replied to.
	function replyName(): string {
		const msg = chat.replyingTo;
		if (!msg) return '';
		const m = chat.selectedChat?.members.find((mm) => mm.id === msg.sender_id);
		return m?.display_name || m?.username || 'Unknown';
	}

	// Esc cancels an in-progress reply or edit.
	function onComposerKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		} else if (e.key === 'Escape') {
			if (isEditing) chat.cancelEdit();
			else if (chat.replyingTo) chat.cancelReply();
		} else if (!isEditing && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
			// A printable character — signal that we're typing (throttled in the store).
			chat.notifyTyping();
		}
	}
</script>

<svelte:window
	ondragover={onWindowDragOver}
	ondragleave={onWindowDragLeave}
	ondrop={onWindowDrop}
/>

{#if dragActive}
	<div class="drop-overlay">
		<div class="drop-hint">
			<svg
				width="40"
				height="40"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<path d="M7 10l5-5 5 5" />
				<path d="M12 5v13" />
			</svg>
			<span>Drop files to send</span>
		</div>
	</div>
{/if}

<div class="composer" onpaste={handlePaste}>
	{#if isEditing || chat.replyingTo}
		<div class="context-bar">
			<span class="context-accent" aria-hidden="true"></span>
			<div class="context-body">
				<span class="context-title">
					{isEditing ? 'Editing message' : `Reply to ${replyName()}`}
				</span>
				<span class="context-snippet">
					{#if isEditing}
						{chat.editingText}
					{:else}
						{chat.replyingTo?.text || 'Attachment'}
					{/if}
				</span>
			</div>
			<button
				class="context-close"
				onclick={() => (isEditing ? chat.cancelEdit() : chat.cancelReply())}
				title="Cancel"
				aria-label="Cancel">×</button
			>
		</div>
	{/if}

	{#if pending.length > 0}
		<div class="attach-row">
			{#each pending as p (p.uid)}
				<div class="chip" class:error={p.status === 'error'}>
					{#if p.previewUrl}
						<img class="chip-thumb" src={p.previewUrl} alt="" />
					{:else}
						<span class="chip-icon" aria-hidden="true">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<path d="M14 2v6h6" />
							</svg>
						</span>
					{/if}
					<span class="chip-meta">
						<span class="chip-name" title={p.filename}>{p.filename}</span>
						<span class="chip-sub">
							{#if p.status === 'uploading'}
								{#if p.phase === 'processing'}Compressing {p.progress ?? 0}%{:else}Uploading…{/if}
							{:else if p.status === 'error'}Failed{:else}{formatBytes(p.sizeBytes)}{/if}
						</span>
					</span>
					{#if p.status === 'uploading'}
						<span class="chip-spinner" aria-label="Uploading"></span>
					{/if}
					<button
						class="chip-remove"
						onclick={() => removePending(p.uid)}
						title={p.status === 'uploading' ? 'Cancel' : 'Remove'}
						aria-label={p.status === 'uploading' ? 'Cancel upload' : 'Remove attachment'}>×</button
					>
				</div>
			{/each}
		</div>
	{/if}

	<div class="input-area">
		<input bind:this={fileInput} type="file" multiple hidden onchange={handleFiles} />
		{#if !isEditing}
			<button class="attach-btn" onclick={pickFiles} title="Attach file" aria-label="Attach file">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
					/>
				</svg>
			</button>
		{/if}
		<TextField
			placeholder={isEditing ? 'Edit message…' : 'Type a message…'}
			bind:value={inputText}
			style="flex: 1; min-width: 0"
			onkeydown={onComposerKeydown}
		/>
		<button
			class="send-btn"
			onclick={send}
			disabled={!canSend}
			title="Send"
			aria-label="Send message"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M12 19V5" />
				<path d="M6 11l6-6 6 6" />
			</svg>
		</button>
	</div>
</div>

<style>
	.composer {
		flex-shrink: 0;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		background: #ffffff;
	}

	.context-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px 0;
	}

	.context-accent {
		width: 3px;
		align-self: stretch;
		min-height: 30px;
		border-radius: 2px;
		background: var(--fluent-accent-primary, #3eb489);
		flex-shrink: 0;
	}

	.context-body {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.context-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--fluent-accent-primary, #3eb489);
	}

	.context-snippet {
		font-size: 12px;
		color: rgba(0, 0, 0, 0.55);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.context-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: rgba(0, 0, 0, 0.45);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}

	.context-close:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #1f1f1f;
	}

	.drop-overlay {
		position: fixed;
		inset: 0;
		z-index: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(62, 180, 137, 0.12);
		backdrop-filter: blur(1px);
		pointer-events: none;
	}

	.drop-hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 28px 40px;
		border: 2px dashed var(--fluent-accent-primary, #3eb489);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.9);
		color: #2a2a30;
		font-size: 15px;
		font-weight: 600;
	}

	.drop-hint svg {
		color: var(--fluent-accent-primary, #3eb489);
	}

	.attach-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 10px 16px 0;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 240px;
		padding: 6px 8px;
		border-radius: 10px;
		background: #f0f0f4;
	}

	.chip.error {
		background: rgba(231, 76, 60, 0.12);
	}

	.chip-thumb {
		width: 32px;
		height: 32px;
		border-radius: 6px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.chip-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.06);
		color: rgba(0, 0, 0, 0.55);
		flex-shrink: 0;
	}

	.chip-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.chip-name {
		font-size: 12px;
		color: #1f1f1f;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chip-sub {
		font-size: 10px;
		color: rgba(0, 0, 0, 0.45);
	}

	.chip.error .chip-sub {
		color: #e74c3c;
	}

	.chip-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: rgba(0, 0, 0, 0.45);
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
	}

	.chip-remove:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #1f1f1f;
	}

	.chip-spinner {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		border: 2px solid rgba(0, 0, 0, 0.15);
		border-top-color: var(--fluent-accent-primary, #3eb489);
		border-radius: 50%;
		animation: chip-spin 0.7s linear infinite;
	}

	@keyframes chip-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.input-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
	}

	.attach-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: rgba(0, 0, 0, 0.5);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.attach-btn:hover {
		background: rgba(0, 0, 0, 0.06);
		color: #1f1f1f;
	}

	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--fluent-accent-primary, #3eb489);
		color: #ffffff;
		cursor: pointer;
		transition:
			background 0.15s,
			transform 0.1s;
	}

	.send-btn:hover:not(:disabled) {
		background: #35a07b;
	}

	.send-btn:active:not(:disabled) {
		transform: scale(0.93);
	}

	.send-btn:disabled {
		background: rgba(0, 0, 0, 0.12);
		color: rgba(0, 0, 0, 0.35);
		cursor: default;
	}

	@media (prefers-color-scheme: dark) {
		.composer {
			background: #1e1e24;
			border-top-color: rgba(255, 255, 255, 0.07);
		}
		.context-snippet {
			color: rgba(255, 255, 255, 0.5);
		}
		.context-close {
			color: rgba(255, 255, 255, 0.5);
		}
		.context-close:hover {
			background: rgba(255, 255, 255, 0.1);
			color: #ffffff;
		}
		.drop-hint {
			background: rgba(30, 30, 36, 0.92);
			color: #e8e8ea;
		}
		.chip {
			background: #2e2e3a;
		}
		.chip-icon {
			background: rgba(255, 255, 255, 0.08);
			color: rgba(255, 255, 255, 0.6);
		}
		.chip-name {
			color: #e8e8ea;
		}
		.chip-sub {
			color: rgba(255, 255, 255, 0.4);
		}
		.chip-remove {
			color: rgba(255, 255, 255, 0.5);
		}
		.chip-remove:hover {
			background: rgba(255, 255, 255, 0.1);
			color: #ffffff;
		}
		.attach-btn {
			color: rgba(255, 255, 255, 0.55);
		}
		.attach-btn:hover {
			background: rgba(255, 255, 255, 0.08);
			color: #ffffff;
		}
		.send-btn:disabled {
			background: rgba(255, 255, 255, 0.1);
			color: rgba(255, 255, 255, 0.35);
		}
	}
</style>
