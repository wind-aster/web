<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { chat } from '$lib/stores/chat.svelte';
	import { SYSTEM_USER_ID, QUICK_REACTIONS } from '$lib/constants';
	import { formatTime, formatBytes, sameDay, formatDaySeparator } from '$lib/utils/format';
	import { getAvatarColor } from '$lib/utils/avatar';
	import { getFile } from '$lib/api/uploads';
	import { SvelteSet } from 'svelte/reactivity';
	import { Dialog } from 'svelte-fluentui';
	import MediaViewer, { type MediaItem } from './MediaViewer.svelte';
	import type { Message, Attachment, Reaction, MemberStatus } from '$lib/api/chats';

	// The open right-click action menu (target message + cursor coords), its
	// clamped on-screen position, and which message is pending delete confirmation.
	let menu = $state<{ msg: Message; x: number; y: number } | null>(null);
	let menuEl = $state<HTMLElement | null>(null);
	let menuPos = $state<{ x: number; y: number } | null>(null);
	let confirmDeleteId = $state<number | null>(null);

	// Keep the menu fully on-screen: measure it, then clamp/flip within the viewport.
	$effect(() => {
		if (!menu || !menuEl) {
			menuPos = null;
			return;
		}
		const w = menuEl.offsetWidth;
		const h = menuEl.offsetHeight;
		const x = Math.max(8, Math.min(menu.x, window.innerWidth - w - 8));
		const y = Math.max(8, Math.min(menu.y, window.innerHeight - h - 8));
		menuPos = { x, y };
	});

	function openMenu(e: MouseEvent, msg: Message) {
		e.preventDefault();
		menu = { msg, x: e.clientX, y: e.clientY };
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') menu = null;
	}

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
			const a = await getFile(id);
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

	function doReply(msg: Message) {
		chat.startReply(msg);
		menu = null;
	}

	function doEdit(msg: Message) {
		chat.startEdit(msg);
		menu = null;
	}

	function doDelete(msg: Message) {
		confirmDeleteId = msg.id;
		menu = null;
	}

	function doReact(msg: Message, emoji: string) {
		chat.toggleReaction(msg, emoji);
		menu = null;
	}

	// Whether the current user is among those who added a given emoji.
	function iReacted(r: Reaction): boolean {
		return auth.userId !== null && r.user_ids.includes(auth.userId);
	}

	// Whether the current user has reacted to a message with a specific emoji
	// (used to highlight the picker row).
	function reactedWith(msg: Message, emoji: string): boolean {
		return !!msg.reactions?.some((r) => r.emoji === emoji && iReacted(r));
	}

	// Mark the open chat read up to its latest message — only when the window is
	// focused, so a background tab doesn't silently clear "unread".
	function markReadLatest() {
		const id = chat.selectedChatId;
		const last = chat.messages.at(-1);
		// Gate on tab visibility (not focus) so a visible-but-unfocused window
		// — e.g. two windows side by side — still registers the read.
		if (
			id !== null &&
			last &&
			typeof document !== 'undefined' &&
			document.visibilityState === 'visible'
		) {
			chat.markRead(id, last.id);
		}
	}

	$effect(() => {
		// markReadLatest reads chat.selectedChatId + chat.messages, so this effect
		// re-runs on chat switch and on every new message.
		markReadLatest();
	});

	// The other participant's read/delivered pointers (DMs only; groups deferred).
	function otherStatus(): MemberStatus | null {
		const c = chat.selectedChat;
		if (!c || c.type !== 'direct') return null;
		return c.member_status.find((s) => s.user_id !== auth.userId) ?? null;
	}

	// Delivery/read state of one of my sent messages (null = no tick, e.g. groups).
	function msgStatus(msg: Message): 'sent' | 'delivered' | 'read' | null {
		if (!isMine(msg) || isSystem(msg)) return null;
		const os = otherStatus();
		if (!os) return null;
		if (os.last_read >= msg.id) return 'read';
		if (os.last_delivered >= msg.id) return 'delivered';
		return 'sent';
	}

	// Scroll to a still-loaded message (e.g. clicking a reply quote). Best-effort:
	// if the target isn't in the current page, nothing happens.
	function scrollToMessage(id: number) {
		const target = el?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
		if (target) {
			target.scrollIntoView({ behavior: 'smooth', block: 'center' });
			target.classList.add('flash');
			setTimeout(() => target.classList.remove('flash'), 1200);
		}
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
		// A fixed-position menu would detach from its message on scroll — close it.
		if (menu) menu = null;
		if (!el || pendingPrepend || chat.loadingOlder || !chat.hasMoreOlder) return;
		if (el.scrollTop <= 80) {
			pendingPrepend = true;
			prevHeight = el.scrollHeight;
			prevTop = el.scrollTop;
			chat.loadOlder();
		}
	}

	// Only auto-scroll to the bottom on a chat switch or when the list grows
	// (a new message). In-place edits/deletes must not yank the viewport.
	let prevLen = 0;
	let prevChat: number | null = null;
	$effect(() => {
		const len = chat.messages.length;
		const cid = chat.selectedChatId;
		if (!el) return;
		if (pendingPrepend) {
			// Keep the previously-visible content in place after prepending.
			el.scrollTop = el.scrollHeight - prevHeight + prevTop;
			pendingPrepend = false;
		} else if (cid !== prevChat || len > prevLen) {
			el.scrollTop = el.scrollHeight;
		}
		prevLen = len;
		prevChat = cid;
	});
</script>

<svelte:window
	onclick={() => (menu = null)}
	onkeydown={onWindowKeydown}
	onresize={() => (menu = null)}
	onfocus={markReadLatest}
/>
<svelte:document onvisibilitychange={markReadLatest} />

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
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="message-row"
					class:mine={isMine(msg)}
					data-mid={msg.id}
					oncontextmenu={(e) => openMenu(e, msg)}
				>
					<div class="bubble" class:bubble-mine={isMine(msg)}>
						{#if showSenderTag(msg, i)}
							<span class="bubble-sender" style="color: {getAvatarColor(senderName(msg))}">
								{senderName(msg)}
							</span>
						{/if}
						{#if msg.reply_preview}
							<button class="reply-quote" onclick={() => scrollToMessage(msg.reply_preview!.id)}>
								<span class="reply-quote-name">{msg.reply_preview.sender_name || 'Unknown'}</span>
								<span class="reply-quote-text">{msg.reply_preview.text}</span>
							</button>
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
						<span class="bubble-time">
							{#if msg.edited_at}<span class="edited">edited</span>{/if}
							{formatTime(msg.created_at)}
							{#if msgStatus(msg)}
								{@const st = msgStatus(msg)}
								{#if st === 'sent'}
									<svg class="tick" viewBox="0 0 16 12" fill="none" aria-label="Sent">
										<path
											d="M2 6.5 5.5 10 12 2.5"
											stroke="currentColor"
											stroke-width="1.6"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{:else}
									<svg
										class="tick"
										class:read={st === 'read'}
										viewBox="0 0 20 12"
										fill="none"
										aria-label={st === 'read' ? 'Read' : 'Delivered'}
									>
										<path
											d="M2 6.5 5.5 10 12 2.5"
											stroke="currentColor"
											stroke-width="1.6"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										<path
											d="M8 6.5 11.5 10 18 2.5"
											stroke="currentColor"
											stroke-width="1.6"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{/if}
							{/if}
						</span>
						{#if msg.reactions && msg.reactions.length > 0}
							<div class="reactions">
								{#each msg.reactions as r (r.emoji)}
									<button
										class="reaction-chip"
										class:reacted={iReacted(r)}
										onclick={() => chat.toggleReaction(msg, r.emoji)}
										title={`${r.count} reacted`}
									>
										<span class="reaction-emoji">{r.emoji}</span>
										<span class="reaction-count">{r.count}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>

{#if viewerIndex !== null}
	<MediaViewer items={mediaItems} index={viewerIndex} onclose={() => (viewerIndex = null)} />
{/if}

{#if menu}
	{@const m = menu}
	<div
		class="action-menu"
		bind:this={menuEl}
		style="left: {menuPos?.x ?? m.x}px; top: {menuPos?.y ?? m.y}px; visibility: {menuPos
			? 'visible'
			: 'hidden'};"
	>
		<div class="reaction-picker">
			{#each QUICK_REACTIONS as emoji (emoji)}
				<button
					class="reaction-option"
					class:active={reactedWith(m.msg, emoji)}
					onclick={() => doReact(m.msg, emoji)}
					aria-label={`React ${emoji}`}
				>
					{emoji}
				</button>
			{/each}
		</div>
		<button onclick={() => doReply(m.msg)}>Reply</button>
		{#if isMine(m.msg)}
			<button onclick={() => doEdit(m.msg)}>Edit</button>
			<button class="danger" onclick={() => doDelete(m.msg)}>Delete</button>
		{/if}
	</div>
{/if}

<Dialog
	modal
	visible={confirmDeleteId !== null}
	title="Delete message?"
	onClose={() => (confirmDeleteId = null)}
	primaryAction={{
		label: 'Delete',
		appearance: 'accent',
		onClick: () => {
			if (confirmDeleteId !== null) chat.removeMessage(confirmDeleteId);
			confirmDeleteId = null;
		}
	}}
	secondaryAction={{
		label: 'Cancel',
		onClick: () => {
			confirmDeleteId = null;
		}
	}}
>
	This message will be removed for everyone. Any attached files are permanently deleted.
</Dialog>

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

	/* Right-click action menu — fixed to the viewport, positioned at the cursor. */
	.action-menu {
		position: fixed;
		z-index: 1000;
		min-width: 120px;
		padding: 4px;
		display: flex;
		flex-direction: column;
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 10px;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
	}

	.action-menu button {
		text-align: left;
		padding: 7px 10px;
		border: none;
		background: transparent;
		border-radius: 6px;
		font-size: 13px;
		color: #1f1f1f;
		cursor: pointer;
	}

	.action-menu button:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.action-menu button.danger {
		color: #d13438;
	}

	.action-menu button.danger:hover {
		background: rgba(209, 52, 56, 0.1);
	}

	/* Emoji picker row at the top of the action menu. */
	.reaction-picker {
		display: flex;
		gap: 2px;
		padding: 2px 2px 6px;
		margin-bottom: 4px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}

	.reaction-option {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: transparent;
		font-size: 17px;
		line-height: 1;
		cursor: pointer;
	}

	.reaction-option:hover {
		background: rgba(0, 0, 0, 0.08);
	}

	.reaction-option.active {
		background: rgba(62, 180, 137, 0.18);
	}

	/* Reaction chips under a bubble. */
	.reactions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}

	.reaction-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 7px;
		border: 1px solid transparent;
		border-radius: 11px;
		background: rgba(0, 0, 0, 0.06);
		font-size: 12px;
		line-height: 18px;
		color: inherit;
		cursor: pointer;
	}

	.reaction-chip .reaction-count {
		font-size: 11px;
		color: rgba(0, 0, 0, 0.55);
	}

	.reaction-chip.reacted {
		background: rgba(62, 180, 137, 0.16);
		border-color: var(--fluent-accent-primary, #3eb489);
	}

	.reaction-chip.reacted .reaction-count {
		color: var(--fluent-accent-primary, #3eb489);
	}

	/* On own (green) bubbles the chips need lighter contrast. */
	.bubble-mine .reaction-chip {
		background: rgba(255, 255, 255, 0.2);
	}

	.bubble-mine .reaction-chip .reaction-count {
		color: rgba(255, 255, 255, 0.85);
	}

	.bubble-mine .reaction-chip.reacted {
		background: rgba(255, 255, 255, 0.35);
		border-color: #ffffff;
	}

	.bubble-mine .reaction-chip.reacted .reaction-count {
		color: #ffffff;
	}

	/* Reply quote inside a bubble. */
	.reply-quote {
		display: flex;
		flex-direction: column;
		gap: 1px;
		text-align: left;
		margin-bottom: 2px;
		padding: 3px 8px;
		border: none;
		border-left: 3px solid var(--fluent-accent-primary, #3eb489);
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.05);
		cursor: pointer;
	}

	.reply-quote-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--fluent-accent-primary, #3eb489);
	}

	.reply-quote-text {
		font-size: 12px;
		color: rgba(0, 0, 0, 0.55);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 220px;
	}

	.bubble-mine .reply-quote {
		background: rgba(255, 255, 255, 0.18);
		border-left-color: rgba(255, 255, 255, 0.85);
	}

	.bubble-mine .reply-quote-name {
		color: #ffffff;
	}

	.bubble-mine .reply-quote-text {
		color: rgba(255, 255, 255, 0.8);
	}

	.edited {
		font-style: italic;
		opacity: 0.75;
		margin-right: 3px;
	}

	.message-row:global(.flash) .bubble {
		animation: flash 1.2s ease;
	}

	@keyframes flash {
		0% {
			box-shadow: 0 0 0 0 rgba(62, 180, 137, 0.5);
		}
		100% {
			box-shadow: 0 0 0 6px rgba(62, 180, 137, 0);
		}
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
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.bubble-mine .bubble-time {
		color: rgba(255, 255, 255, 0.65);
	}

	/* Delivery/read ticks — only shown on my own (green) bubbles. */
	.tick {
		width: 15px;
		height: 11px;
		flex-shrink: 0;
		color: inherit;
	}

	.tick.read {
		color: #ffffff;
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
		.action-menu {
			background: #2e2e3a;
			border-color: rgba(255, 255, 255, 0.1);
			box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
		}
		.action-menu button {
			color: #e8e8ea;
		}
		.action-menu button:hover {
			background: rgba(255, 255, 255, 0.08);
		}
		.action-menu button.danger {
			color: #ff8a90;
		}
		.action-menu button.danger:hover {
			background: rgba(255, 138, 144, 0.12);
		}
		.reaction-picker {
			border-bottom-color: rgba(255, 255, 255, 0.1);
		}
		.reaction-option:hover {
			background: rgba(255, 255, 255, 0.1);
		}
		.reaction-chip {
			background: rgba(255, 255, 255, 0.08);
		}
		.reaction-chip .reaction-count {
			color: rgba(255, 255, 255, 0.55);
		}
		.reaction-chip.reacted {
			background: rgba(62, 180, 137, 0.24);
		}
		.reply-quote {
			background: rgba(255, 255, 255, 0.06);
		}
		.reply-quote-text {
			color: rgba(255, 255, 255, 0.5);
		}
	}
</style>
