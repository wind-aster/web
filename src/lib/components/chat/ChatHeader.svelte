<script lang="ts">
	import { chat } from '$lib/stores/chat.svelte';
	import type { ChatDetail } from '$lib/api/chats';
	import Avatar from './Avatar.svelte';

	let { selectedChat }: { selectedChat: ChatDetail } = $props();

	const name = $derived(chat.chatName(selectedChat));
</script>

<div class="chat-header">
	<Avatar {name} size={36} />
	<div class="header-info">
		<span class="header-name">{name}</span>
		{#if selectedChat.type === 'group'}
			<span class="header-sub">{selectedChat.members.length} members</span>
		{:else}
			<span class="header-sub">Direct message</span>
		{/if}
	</div>
</div>

<style>
	.chat-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		flex-shrink: 0;
		background: #ffffff;
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
		.chat-header {
			background: #1e1e24;
			border-bottom-color: rgba(255, 255, 255, 0.07);
		}
		.header-name {
			color: #e8e8ea;
		}
		.header-sub {
			color: rgba(255, 255, 255, 0.45);
		}
	}
</style>
