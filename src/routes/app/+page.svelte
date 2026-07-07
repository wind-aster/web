<script lang="ts">
	import { Button, TextField } from 'svelte-fluentui';
	import { auth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { getChats, type ChatDetail, type Message } from '$lib/api/chats';
	import { getMessages, sendMessageRest } from '$lib/api/messages';
	import { connectWS, sendWS, disconnectWS } from '$lib/api/ws';

	$effect(() => {
		if (!auth.isAuthenticated) goto('/login', { replaceState: true });
	});

	let chats = $state<ChatDetail[]>([]);
	let selectedChatId = $state<number | null>(null);
	let messages = $state<Message[]>([]);
	let inputText = $state('');
	let loadingMessages = $state(false);
	let messagesEl = $state<HTMLElement | null>(null);

	const selectedChat = $derived(chats.find((c) => c.id === selectedChatId) ?? null);

	$effect(() => {
		const token = auth.token;
		if (!token) return;

		getChats(token).then((data) => {
			chats = data ?? [];
		});

		connectWS(token, (msg) => {
			if (msg.chat_id === selectedChatId) {
				messages = [...messages, msg];
				scheduleScroll();
			}
			chats = chats.map((c) =>
				c.id === msg.chat_id
					? { ...c, last_messages: [...c.last_messages.slice(-4), msg] }
					: c
			);
		});

		return () => disconnectWS();
	});

	function scheduleScroll() {
		setTimeout(() => {
			if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
		}, 0);
	}

	async function selectChat(id: number) {
		if (selectedChatId === id) return;
		selectedChatId = id;
		messages = [];
		loadingMessages = true;
		try {
			if (auth.token) messages = (await getMessages(auth.token, id)) ?? [];
		} finally {
			loadingMessages = false;
		}
		scheduleScroll();
	}

	async function sendMessage() {
		const text = inputText.trim();
		if (!text || selectedChatId === null) return;

		const sent = sendWS(selectedChatId, text);
		if (sent) {
			inputText = '';
			return;
		}

		// WS not connected — fall back to REST and add optimistically
		if (!auth.token) return;
		try {
			const res = await sendMessageRest(auth.token, selectedChatId, text);
			inputText = '';
			messages = [
				...messages,
				{
					id: res.message_id,
					sender_id: auth.userId ?? 0,
					chat_id: selectedChatId,
					text,
					created_at: res.created_at
				}
			];
			scheduleScroll();
		} catch (e) {
			console.error('Send failed', e);
		}
	}

	function getChatName(chat: ChatDetail): string {
		if (chat.type === 'direct') {
			const other = chat.members.find((m) => m.id !== auth.userId);
			return other?.display_name || other?.username || chat.title;
		}
		return chat.title;
	}

	function getAvatarColor(name: string): string {
		const palette = [
			'#3eb489',
			'#4a90d9',
			'#9b59b6',
			'#e67e22',
			'#e74c3c',
			'#1abc9c',
			'#2980b9',
			'#8e44ad'
		];
		let h = 0;
		for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
		return palette[h % palette.length];
	}

	function getLastPreview(chat: ChatDetail): string {
		const last = chat.last_messages.at(-1);
		if (!last) return 'No messages yet';
		return last.text.length > 44 ? last.text.slice(0, 44) + '…' : last.text;
	}

	function getLastTime(chat: ChatDetail): string {
		const last = chat.last_messages.at(-1);
		return last ? formatTime(last.created_at) : '';
	}

	function formatTime(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		const sameDay =
			d.getDate() === now.getDate() &&
			d.getMonth() === now.getMonth() &&
			d.getFullYear() === now.getFullYear();
		return sameDay
			? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	function isMine(msg: Message): boolean {
		return msg.sender_id === auth.userId;
	}

	function handleLogout() {
		auth.logout();
		goto('/login', { replaceState: true });
	}
</script>

<div class="shell">
	<div class="app">
		<!-- Sidebar -->
		<aside class="sidebar">
			<div class="sidebar-top">
				<span class="logo">WindAster</span>
				<button class="logout-btn" onclick={handleLogout} title="Sign out">
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>

			<div class="user-row">
				<div
					class="user-avatar"
					style="background: {getAvatarColor(auth.user?.username ?? 'me')}"
				>
					{(auth.user?.username || 'M').charAt(0).toUpperCase()}
				</div>
				<span class="user-name">{auth.user?.username || 'Me'}</span>
			</div>

			<div class="chat-list">
				{#if chats.length === 0}
					<p class="empty-chats">No conversations yet</p>
				{:else}
					{#each chats as chat (chat.id)}
						{@const name = getChatName(chat)}
						<button
							class="chat-item"
							class:active={chat.id === selectedChatId}
							onclick={() => selectChat(chat.id)}
						>
							<div class="chat-avatar" style="background: {getAvatarColor(name)}">
								{name.charAt(0).toUpperCase()}
							</div>
							<div class="chat-info">
								<div class="chat-item-row">
									<span class="chat-name">{name}</span>
									<span class="chat-time">{getLastTime(chat)}</span>
								</div>
								<span class="chat-preview">{getLastPreview(chat)}</span>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</aside>

		<!-- Chat panel -->
		<main class="chat-panel">
			{#if selectedChat}
				{@const chatName = getChatName(selectedChat)}

				<div class="chat-header">
					<div class="header-avatar" style="background: {getAvatarColor(chatName)}">
						{chatName.charAt(0).toUpperCase()}
					</div>
					<div class="header-info">
						<span class="header-name">{chatName}</span>
						{#if selectedChat.type === 'group'}
							<span class="header-sub">{selectedChat.members.length} members</span>
						{:else}
							<span class="header-sub">Direct message</span>
						{/if}
					</div>
				</div>

				<div class="messages" bind:this={messagesEl}>
					{#if loadingMessages}
						<p class="loading-msg">Loading…</p>
					{:else if messages.length === 0}
						<p class="loading-msg">No messages yet. Say hello!</p>
					{:else}
						{#each messages as msg (msg.id)}
							<div class="message-row" class:mine={isMine(msg)}>
								<div class="bubble" class:bubble-mine={isMine(msg)}>
									<span class="bubble-text">{msg.text}</span>
									<span class="bubble-time">{formatTime(msg.created_at)}</span>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<div class="input-area">
					<TextField
						placeholder="Type a message…"
						bind:value={inputText}
						style="flex: 1; min-width: 0"
						onkeydown={(e: KeyboardEvent) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								sendMessage();
							}
						}}
					/>
					<Button appearance="accent" onclick={sendMessage}>Send</Button>
				</div>
			{:else}
				<div class="empty-state">
					<svg
						width="48"
						height="48"
						viewBox="0 0 48 48"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						class="empty-icon"
					>
						<path
							d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H16l-8 6V12Z"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					<p>Select a conversation to start chatting</p>
				</div>
			{/if}
		</main>
	</div>
</div>

<style>
	.shell {
		height: 100vh;
		display: flex;
		align-items: stretch;
		padding: 20px;
		box-sizing: border-box;
		background: #e2e2e6;
	}

	@media (prefers-color-scheme: dark) {
		.shell {
			background: #0e0e10;
		}
	}

	.app {
		display: flex;
		flex: 1;
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		border-radius: 12px;
		overflow: hidden;
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.08);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.10),
			0 2px 8px rgba(0, 0, 0, 0.06);
	}

	@media (prefers-color-scheme: dark) {
		.app {
			background: #1e1e24;
			border-color: rgba(255, 255, 255, 0.07);
			box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
		}
	}

	/* ── Sidebar ── */

	.sidebar {
		width: 280px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: #f5f5f7;
		border-right: 1px solid rgba(0, 0, 0, 0.08);
		overflow: hidden;
	}

	@media (prefers-color-scheme: dark) {
		.sidebar {
			background: #18181e;
			border-right-color: rgba(255, 255, 255, 0.07);
		}
	}

	.sidebar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 16px 10px;
	}

	.logo {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.3px;
		color: #3eb489;
	}

	.logout-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		border-radius: 6px;
		cursor: pointer;
		color: rgba(0, 0, 0, 0.45);
		transition: background 0.15s, color 0.15s;
		padding: 0;
	}

	.logout-btn:hover {
		background: rgba(0, 0, 0, 0.07);
		color: rgba(0, 0, 0, 0.8);
	}

	@media (prefers-color-scheme: dark) {
		.logout-btn {
			color: rgba(255, 255, 255, 0.4);
		}
		.logout-btn:hover {
			background: rgba(255, 255, 255, 0.07);
			color: rgba(255, 255, 255, 0.85);
		}
	}

	.user-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px 12px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		margin-bottom: 4px;
	}

	@media (prefers-color-scheme: dark) {
		.user-row {
			border-bottom-color: rgba(255, 255, 255, 0.06);
		}
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 600;
		color: #fff;
		flex-shrink: 0;
	}

	.user-name {
		font-size: 13px;
		font-weight: 500;
		color: #1f1f1f;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (prefers-color-scheme: dark) {
		.user-name {
			color: #e8e8ea;
		}
	}

	.chat-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 8px;
	}

	.empty-chats {
		margin: 24px 8px;
		font-size: 13px;
		color: rgba(0, 0, 0, 0.4);
		text-align: center;
	}

	@media (prefers-color-scheme: dark) {
		.empty-chats {
			color: rgba(255, 255, 255, 0.35);
		}
	}

	.chat-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border: none;
		background: none;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition: background 0.12s;
		color: inherit;
	}

	.chat-item:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.chat-item.active {
		background: rgba(62, 180, 137, 0.14);
	}

	@media (prefers-color-scheme: dark) {
		.chat-item:hover {
			background: rgba(255, 255, 255, 0.05);
		}
		.chat-item.active {
			background: rgba(62, 180, 137, 0.18);
		}
	}

	.chat-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		font-weight: 600;
		color: #fff;
		flex-shrink: 0;
	}

	.chat-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.chat-item-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px;
	}

	.chat-name {
		font-size: 14px;
		font-weight: 500;
		color: #1f1f1f;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chat-time {
		font-size: 11px;
		color: rgba(0, 0, 0, 0.4);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.chat-preview {
		font-size: 12px;
		color: rgba(0, 0, 0, 0.5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (prefers-color-scheme: dark) {
		.chat-name {
			color: #e8e8ea;
		}
		.chat-time {
			color: rgba(255, 255, 255, 0.38);
		}
		.chat-preview {
			color: rgba(255, 255, 255, 0.45);
		}
	}

	/* ── Chat panel ── */

	.chat-panel {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: #ffffff;
	}

	@media (prefers-color-scheme: dark) {
		.chat-panel {
			background: #1e1e24;
		}
	}

	.chat-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		flex-shrink: 0;
		background: #ffffff;
	}

	@media (prefers-color-scheme: dark) {
		.chat-header {
			background: #1e1e24;
			border-bottom-color: rgba(255, 255, 255, 0.07);
		}
	}

	.header-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 600;
		color: #fff;
		flex-shrink: 0;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.header-name {
		font-size: 15px;
		font-weight: 600;
		color: #1f1f1f;
	}

	.header-sub {
		font-size: 12px;
		color: rgba(0, 0, 0, 0.5);
	}

	@media (prefers-color-scheme: dark) {
		.header-name {
			color: #e8e8ea;
		}
		.header-sub {
			color: rgba(255, 255, 255, 0.45);
		}
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: #f7f7f9;
	}

	@media (prefers-color-scheme: dark) {
		.messages {
			background: #252530;
		}
	}

	.loading-msg {
		margin: auto;
		font-size: 13px;
		color: rgba(0, 0, 0, 0.4);
		text-align: center;
	}

	@media (prefers-color-scheme: dark) {
		.loading-msg {
			color: rgba(255, 255, 255, 0.35);
		}
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
		.bubble {
			background: #2e2e3a;
		}
		.bubble-text {
			color: #e8e8ea;
		}
		.bubble-time {
			color: rgba(255, 255, 255, 0.38);
		}
	}

	.input-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		background: #ffffff;
		flex-shrink: 0;
	}

	@media (prefers-color-scheme: dark) {
		.input-area {
			background: #1e1e24;
			border-top-color: rgba(255, 255, 255, 0.07);
		}
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: rgba(0, 0, 0, 0.35);
		font-size: 14px;
	}

	.empty-icon {
		opacity: 0.3;
	}

	@media (prefers-color-scheme: dark) {
		.empty-state {
			color: rgba(255, 255, 255, 0.3);
		}
	}
</style>
