<script lang="ts">
	import { chat } from '$lib/stores/chat.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { chatPreview, chatTime } from '$lib/utils/format';
	import type { ChatDetail } from '$lib/api/chats';
	import Avatar from './Avatar.svelte';

	// Online status of the other participant in a DM (undefined for groups).
	function dmOnline(c: ChatDetail): boolean {
		if (c.type !== 'direct') return false;
		const other = c.members.find((m) => m.id !== auth.userId);
		return other ? chat.presenceFor(other.id).online : false;
	}
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
				<Avatar {name} size={40} online={dmOnline(c)} />
				<div class="chat-info">
					<div class="chat-item-row">
						<span class="chat-name">{name}</span>
						<span class="chat-time">{chatTime(c)}</span>
					</div>
					<div class="chat-item-row">
						<span class="chat-preview">{chatPreview(c)}</span>
						{#if c.id !== chat.selectedChatId && c.unread_count > 0}
							<span class="unread-badge">{c.unread_count > 99 ? '99+' : c.unread_count}</span>
						{/if}
					</div>
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
		flex: 1;
		min-width: 0;
		font-size: 12px;
		color: rgba(0, 0, 0, 0.5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.unread-badge {
		flex-shrink: 0;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9px;
		background: var(--fluent-accent-primary, #3eb489);
		color: #ffffff;
		font-size: 11px;
		font-weight: 600;
		line-height: 1;
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
