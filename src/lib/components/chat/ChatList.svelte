<script lang="ts">
	import { chat } from '$lib/stores/chat.svelte';
	import { chatPreview, chatTime } from '$lib/utils/format';
	import Avatar from './Avatar.svelte';
</script>

<div class="chat-list">
	{#if chat.chats.length === 0}
		<p class="empty-chats">No conversations yet</p>
	{:else}
		{#each chat.sortedChats as c (c.id)}
			{@const name = chat.chatName(c)}
			<button
				class="chat-item"
				class:active={c.id === chat.selectedChatId}
				onclick={() => chat.selectChat(c.id)}
			>
				<Avatar {name} size={40} />
				<div class="chat-info">
					<div class="chat-item-row">
						<span class="chat-name">{name}</span>
						<span class="chat-time">{chatTime(c)}</span>
					</div>
					<span class="chat-preview">{chatPreview(c)}</span>
				</div>
			</button>
		{/each}
	{/if}
</div>

<style>
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
		.empty-chats {
			color: rgba(255, 255, 255, 0.35);
		}
		.chat-item:hover {
			background: rgba(255, 255, 255, 0.05);
		}
		.chat-item.active {
			background: rgba(62, 180, 137, 0.18);
		}
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
</style>
