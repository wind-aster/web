<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { logout as apiLogout } from '$lib/api/auth';
	import { chat } from '$lib/stores/chat.svelte';
	import { notifications } from '$lib/stores/notifications.svelte';
	import Sidebar from '$lib/components/chat/Sidebar.svelte';
	import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
	import MessageThread from '$lib/components/chat/MessageThread.svelte';
	import MessageComposer from '$lib/components/chat/MessageComposer.svelte';
	import Toaster from '$lib/components/Toaster.svelte';

	$effect(() => {
		if (!auth.isAuthenticated) goto(resolve('/login'), { replaceState: true });
	});

	$effect(() => {
		const token = auth.token;
		if (!token) return;
		chat.start();
		return () => chat.stop();
	});

	// Ask for notification permission on first load (once), and arm the gesture
	// listener that unlocks the ping audio after an auto-grant.
	$effect(() => {
		if (!auth.isAuthenticated) return;
		notifications.armAudioUnlock();
		notifications.autoRequest();
	});

	// Reflect total unread in the tab title so a backgrounded tab shows activity.
	$effect(() => {
		notifications.setDocumentTitle(chat.totalUnread);
		return () => notifications.setDocumentTitle(0);
	});

	function handleLogout() {
		const rt = auth.refreshToken;
		if (rt) apiLogout(rt); // best-effort server-side revoke
		auth.logout();
		goto(resolve('/login'), { replaceState: true });
	}
</script>

<div class="shell">
	<div class="app">
		<Sidebar onLogout={handleLogout} />

		<main class="chat-panel">
			{#if chat.selectedChat}
				<ChatHeader selectedChat={chat.selectedChat} />
				<MessageThread />
				<MessageComposer />
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

<Toaster />

<style>
	.shell {
		height: 100vh;
		display: flex;
		align-items: stretch;
		padding: 20px;
		box-sizing: border-box;
		background: #e2e2e6;
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
			0 8px 32px rgba(0, 0, 0, 0.1),
			0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.chat-panel {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: #ffffff;
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
		.shell {
			background: #0e0e10;
		}
		.app {
			background: #1e1e24;
			border-color: rgba(255, 255, 255, 0.07);
			box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
		}
		.chat-panel {
			background: #1e1e24;
		}
		.empty-state {
			color: rgba(255, 255, 255, 0.3);
		}
	}
</style>
