<script lang="ts">
	import { TextField } from 'svelte-fluentui';
	import { chat } from '$lib/stores/chat.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { uploadFile, MAX_UPLOAD_SIZE } from '$lib/api/uploads';
	import { formatBytes } from '$lib/utils/format';

	interface Pending {
		uid: number;
		filename: string;
		sizeBytes: number;
		status: 'uploading' | 'done' | 'error';
		attachmentId?: number;
		previewUrl?: string; // local object URL for images
	}

	let inputText = $state('');
	let pending = $state<Pending[]>([]);
	let fileInput = $state<HTMLInputElement | null>(null);
	let uid = 0;

	const uploading = $derived(pending.some((p) => p.status === 'uploading'));
	const ready = $derived(pending.filter((p) => p.status === 'done'));
	const canSend = $derived(!uploading && (inputText.trim().length > 0 || ready.length > 0));

	function pickFiles() {
		fileInput?.click();
	}

	async function handleFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = ''; // allow re-selecting the same file
		const chatId = chat.selectedChatId;
		if (chatId === null || !auth.token) return;

		for (const file of files) {
			if (file.size > MAX_UPLOAD_SIZE) {
				alert(
					`"${file.name}" is ${formatBytes(file.size)} — over the ${formatBytes(MAX_UPLOAD_SIZE)} limit.`
				);
				continue;
			}
			const entry: Pending = {
				uid: uid++,
				filename: file.name,
				sizeBytes: file.size,
				status: 'uploading',
				previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
			};
			pending = [...pending, entry];

			uploadFile(auth.token, chatId, file)
				.then((res) => {
					pending = pending.map((p) =>
						p.uid === entry.uid ? { ...p, status: 'done', attachmentId: res.attachmentId } : p
					);
				})
				.catch((err) => {
					console.error('Upload failed', err);
					pending = pending.map((p) => (p.uid === entry.uid ? { ...p, status: 'error' } : p));
				});
		}
	}

	function removePending(uidToRemove: number) {
		const entry = pending.find((p) => p.uid === uidToRemove);
		if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
		pending = pending.filter((p) => p.uid !== uidToRemove);
	}

	function clearPending() {
		for (const p of pending) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
		pending = [];
	}

	async function send() {
		const text = inputText.trim();
		const ids = ready.map((p) => p.attachmentId!).filter((id) => id !== undefined);
		if (!text && ids.length === 0) return;
		if (uploading) return;

		if (await chat.sendMessage(text, ids)) {
			inputText = '';
			clearPending();
		}
	}
</script>

<div class="composer">
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
							{#if p.status === 'uploading'}Uploading…{:else if p.status === 'error'}Failed{:else}{formatBytes(
									p.sizeBytes
								)}{/if}
						</span>
					</span>
					{#if p.status === 'uploading'}
						<span class="chip-spinner" aria-label="Uploading"></span>
					{:else}
						<button
							class="chip-remove"
							onclick={() => removePending(p.uid)}
							title="Remove"
							aria-label="Remove attachment">×</button
						>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<div class="input-area">
		<input bind:this={fileInput} type="file" multiple hidden onchange={handleFiles} />
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
		<TextField
			placeholder="Type a message…"
			bind:value={inputText}
			style="flex: 1; min-width: 0"
			onkeydown={(e: KeyboardEvent) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					send();
				}
			}}
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
