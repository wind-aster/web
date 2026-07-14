<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { chat } from '$lib/stores/chat.svelte';
	import { SYSTEM_USER_ID } from '$lib/constants';
	import { formatTime, formatBytes, sameDay, formatDaySeparator } from '$lib/utils/format';
	import { getAvatarColor } from '$lib/utils/avatar';
	import { getFile } from '$lib/api/uploads';
	import { SvelteSet } from 'svelte/reactivity';
	import MediaViewer, { type MediaItem } from './MediaViewer.svelte';
	import type { Message, Attachment } from '$lib/api/chats';

	function isImageAttachment(att: Attachment): boolean {
		return att.mime_type.startsWith('image/');
	}

	function isVideoAttachment(att: Attachment): boolean {
		return att.mime_type.startsWith('video/');
	}

	let el = $state<HTMLElement | null>(null);
	let viewerIndex = $state<number | null>(null);

	// Fresh presigned URLs fetched after a link expired (keyed by attachment id).
	let refreshed = $state<Record<number, { url: string; thumb_url?: string }>>({});
	const retried = new SvelteSet<number>();

	function attUrl(att: Attachment): string {
		return refreshed[att.id]?.url ?? att.url;
	}
	function attThumb(att: Attachment): string | undefined {
		return refreshed[att.id]?.thumb_url ?? att.thumb_url;
	}

	// On a broken media element (expired presigned URL), fetch a fresh one once.
	async function refreshUrl(id: number) {
		if (retried.has(id) || !auth.token) return;
		retried.add(id);
		try {
			const a = await getFile(auth.token, id);
			refreshed = { ...refreshed, [id]: { url: a.url, thumb_url: a.thumb_url } };
		} catch {
			// leave broken; a later reload will retry with a fresh page load
		}
	}

	// Flat, ordered list of all viewable media in the thread — powers the
	// fullscreen viewer's prev/next navigation.
	const mediaItems = $derived.by(() => {
		const list: MediaItem[] = [];
		for (const m of chat.messages) {
			for (const att of m.attachments ?? []) {
				if (isImageAttachment(att)) {
					list.push({ id: att.id, url: attUrl(att), filename: att.filename, type: 'image' });
				} else if (isVideoAttachment(att)) {
					list.push({
						id: att.id,
						url: attUrl(att),
						filename: att.filename,
						type: 'video',
						poster: attThumb(att)
					});
				}
			}
		}
		return list;
	});

	function openViewer(att: Attachment) {
		const idx = mediaItems.findIndex((m) => m.id === att.id);
		if (idx >= 0) viewerIndex = idx;
	}

	function isMine(msg: Message): boolean {
		return msg.sender_id === auth.userId;
	}

	function isSystem(msg: Message): boolean {
		return msg.sender_id === SYSTEM_USER_ID;
	}

	function senderName(msg: Message): string {
		const m = chat.selectedChat?.members.find((mm) => mm.id === msg.sender_id);
		return m?.display_name || m?.username || 'Unknown';
	}

	// Show a sender label only in group chats, on incoming bubbles, and only on the
	// first message of a consecutive run from the same sender (a preceding system
	// message has a different sender_id, so the tag reappears after a system notice).
	function showSenderTag(msg: Message, index: number): boolean {
		if (chat.selectedChat?.type !== 'group') return false;
		if (isMine(msg) || isSystem(msg)) return false;
		const prev = chat.messages[index - 1];
		return !prev || prev.sender_id !== msg.sender_id;
	}

	// Scroll handling. On a normal list change (send / incoming / chat switch) we
	// pin to the bottom; when older messages are prepended we instead restore the
	// viewport so it doesn't jump.
	let pendingPrepend = false;
	let prevHeight = 0;
	let prevTop = 0;

	function onScroll() {
		if (!el || pendingPrepend || chat.loadingOlder || !chat.hasMoreOlder) return;
		if (el.scrollTop <= 80) {
			pendingPrepend = true;
			prevHeight = el.scrollHeight;
			prevTop = el.scrollTop;
			chat.loadOlder();
		}
	}

	$effect(() => {
		// Reading .length subscribes the effect to any list change.
		const len = chat.messages.length;
		if (!el) return;
		if (pendingPrepend) {
			// Keep the previously-visible content in place after prepending.
			el.scrollTop = el.scrollHeight - prevHeight + prevTop;
			pendingPrepend = false;
		} else if (len >= 0) {
			el.scrollTop = el.scrollHeight;
		}
	});
</script>

<div class="messages" bind:this={el} onscroll={onScroll}>
	{#if chat.loadingMessages}
		<p class="loading-msg">Loading…</p>
	{:else if chat.messages.length === 0}
		<p class="loading-msg">No messages yet. Say hello!</p>
	{:else}
		{#if chat.loadingOlder}
			<p class="loading-older">Loading older messages…</p>
		{/if}
		{#each chat.messages as msg, i (msg.id)}
			{#if i === 0 || !sameDay(chat.messages[i - 1].created_at, msg.created_at)}
				<div class="day-sep"><span>{formatDaySeparator(msg.created_at)}</span></div>
			{/if}
			{#if isSystem(msg)}
				<div class="system-notice">{msg.text}</div>
			{:else}
				<div class="message-row" class:mine={isMine(msg)}>
					<div class="bubble" class:bubble-mine={isMine(msg)}>
						{#if showSenderTag(msg, i)}
							<span class="bubble-sender" style="color: {getAvatarColor(senderName(msg))}">
								{senderName(msg)}
							</span>
						{/if}
						{#if msg.attachments && msg.attachments.length > 0}
							{@const imgs = msg.attachments.filter(isImageAttachment)}
							{@const others = msg.attachments.filter((a) => !isImageAttachment(a))}
							<div class="attachments">
								{#if imgs.length >= 2}
									<div class="attachments-grid">
										{#each imgs as att (att.id)}
											<button class="att-tile" onclick={() => openViewer(att)}>
												<img
													src={attThumb(att) ?? attUrl(att)}
													alt={att.filename}
													loading="lazy"
													onerror={() => refreshUrl(att.id)}
												/>
											</button>
										{/each}
									</div>
								{:else if imgs.length === 1}
									{@const att = imgs[0]}
									<button class="att-image" onclick={() => openViewer(att)}>
										<img
											src={attThumb(att) ?? attUrl(att)}
											alt={att.filename}
											loading="lazy"
											onerror={() => refreshUrl(att.id)}
										/>
									</button>
								{/if}
								{#each others as att (att.id)}
									{#if isVideoAttachment(att)}
										<button class="att-video-thumb" onclick={() => openViewer(att)}>
											{#if attThumb(att)}
												<img
													src={attThumb(att)}
													alt={att.filename}
													loading="lazy"
													onerror={() => refreshUrl(att.id)}
												/>
											{/if}
											<span class="play-badge" aria-hidden="true">
												<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
													<path d="M8 5v14l11-7z" />
												</svg>
											</span>
										</button>
									{:else}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external presigned storage URL -->
										<a class="att-file" href={attUrl(att)} download={att.filename}>
											<span class="att-file-icon" aria-hidden="true">
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
													<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
													<path d="M14 2v6h6" />
												</svg>
											</span>
											<span class="att-file-meta">
												<span class="att-file-name" title={att.filename}>{att.filename}</span>
												<span class="att-file-size">{formatBytes(att.size_bytes)}</span>
											</span>
											<span class="att-file-dl" aria-hidden="true">
												<svg
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
													<path d="M7 10l5 5 5-5" />
													<path d="M12 15V3" />
												</svg>
											</span>
										</a>
									{/if}
								{/each}
							</div>
						{/if}
						{#if msg.text}
							<span class="bubble-text">{msg.text}</span>
						{/if}
						<span class="bubble-time">{formatTime(msg.created_at)}</span>
					</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>

{#if viewerIndex !== null}
	<MediaViewer items={mediaItems} index={viewerIndex} onclose={() => (viewerIndex = null)} />
{/if}

<style>
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: #f7f7f9;
	}

	.loading-msg {
		margin: auto;
		font-size: 13px;
		color: rgba(0, 0, 0, 0.4);
		text-align: center;
	}

	.loading-older {
		align-self: center;
		margin: 4px 0;
		font-size: 12px;
		color: rgba(0, 0, 0, 0.4);
	}

	.system-notice {
		align-self: center;
		max-width: 80%;
		margin: 4px 0;
		padding: 4px 12px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.06);
		color: rgba(0, 0, 0, 0.5);
		font-size: 12px;
		text-align: center;
		word-break: break-word;
	}

	.message-row {
		display: flex;
		justify-content: flex-start;
	}

	.message-row.mine {
		justify-content: flex-end;
	}

	.bubble {
		display: inline-flex;
		flex-direction: column;
		max-width: 60%;
		padding: 8px 12px;
		border-radius: 14px;
		border-bottom-left-radius: 4px;
		background: #ebebef;
		gap: 2px;
	}

	.bubble-mine {
		background: #3eb489;
		border-bottom-left-radius: 14px;
		border-bottom-right-radius: 4px;
	}

	.bubble-sender {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.2;
		/* color set inline per-sender via getAvatarColor */
	}

	.day-sep {
		align-self: center;
		margin: 8px 0 2px;
	}

	.day-sep span {
		display: inline-block;
		padding: 3px 12px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.06);
		color: rgba(0, 0, 0, 0.5);
		font-size: 11px;
		font-weight: 600;
	}

	.attachments {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.attachments-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		max-width: 260px;
	}

	.att-tile {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		aspect-ratio: 1;
		line-height: 0;
	}

	.att-tile img {
		width: 100%;
		height: 100%;
		border-radius: 8px;
		object-fit: cover;
	}

	.att-image {
		display: block;
		padding: 0;
		border: none;
		background: none;
		line-height: 0;
		cursor: pointer;
	}

	.att-image img {
		max-width: 260px;
		max-height: 320px;
		width: auto;
		height: auto;
		border-radius: 10px;
		object-fit: cover;
	}

	.att-video-thumb {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 120px;
		min-height: 90px;
		max-width: 260px;
		padding: 0;
		border: none;
		border-radius: 10px;
		background: #000;
		cursor: pointer;
		overflow: hidden;
		line-height: 0;
	}

	.att-video-thumb img {
		max-width: 260px;
		max-height: 320px;
		width: auto;
		height: auto;
		object-fit: cover;
	}

	.play-badge {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.55);
		color: #ffffff;
		padding-left: 3px;
		pointer-events: none;
	}

	.att-file {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 180px;
		max-width: 260px;
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.05);
		text-decoration: none;
		color: inherit;
	}

	.att-file:hover {
		background: rgba(0, 0, 0, 0.09);
	}

	.att-file-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		flex-shrink: 0;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.08);
		color: rgba(0, 0, 0, 0.55);
	}

	.att-file-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.att-file-name {
		font-size: 13px;
		color: #1f1f1f;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.att-file-size {
		font-size: 11px;
		color: rgba(0, 0, 0, 0.45);
	}

	.att-file-dl {
		flex-shrink: 0;
		color: rgba(0, 0, 0, 0.4);
	}

	.bubble-mine .att-file {
		background: rgba(255, 255, 255, 0.18);
	}

	.bubble-mine .att-file:hover {
		background: rgba(255, 255, 255, 0.26);
	}

	.bubble-mine .att-file-icon {
		background: rgba(255, 255, 255, 0.22);
		color: #ffffff;
	}

	.bubble-mine .att-file-name {
		color: #ffffff;
	}

	.bubble-mine .att-file-size,
	.bubble-mine .att-file-dl {
		color: rgba(255, 255, 255, 0.7);
	}

	.bubble-text {
		font-size: 14px;
		line-height: 1.45;
		color: #1f1f1f;
		word-break: break-word;
		white-space: pre-wrap;
	}

	.bubble-mine .bubble-text {
		color: #ffffff;
	}

	.bubble-time {
		font-size: 10px;
		color: rgba(0, 0, 0, 0.4);
		align-self: flex-end;
	}

	.bubble-mine .bubble-time {
		color: rgba(255, 255, 255, 0.65);
	}

	@media (prefers-color-scheme: dark) {
		.messages {
			background: #252530;
		}
		.loading-msg,
		.loading-older {
			color: rgba(255, 255, 255, 0.35);
		}
		.system-notice {
			background: rgba(255, 255, 255, 0.07);
			color: rgba(255, 255, 255, 0.5);
		}
		.day-sep span {
			background: rgba(255, 255, 255, 0.08);
			color: rgba(255, 255, 255, 0.5);
		}
		.bubble {
			background: #2e2e3a;
		}
		.bubble-text {
			color: #e8e8ea;
		}
		.bubble-time {
			color: rgba(255, 255, 255, 0.38);
		}
		.att-file {
			background: rgba(255, 255, 255, 0.06);
		}
		.att-file:hover {
			background: rgba(255, 255, 255, 0.1);
		}
		.att-file-icon {
			background: rgba(255, 255, 255, 0.1);
			color: rgba(255, 255, 255, 0.6);
		}
		.att-file-name {
			color: #e8e8ea;
		}
		.att-file-size,
		.att-file-dl {
			color: rgba(255, 255, 255, 0.4);
		}
	}
</style>
