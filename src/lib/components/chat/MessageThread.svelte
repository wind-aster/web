<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { chat } from '$lib/stores/chat.svelte';
	import { SYSTEM_USER_ID } from '$lib/constants';
	import { formatTime } from '$lib/utils/format';
	import type { Message } from '$lib/api/chats';

	let el = $state<HTMLElement | null>(null);

	function isMine(msg: Message): boolean {
		return msg.sender_id === auth.userId;
	}

	function isSystem(msg: Message): boolean {
		return msg.sender_id === SYSTEM_USER_ID;
	}

	// Auto-scroll to the bottom whenever the message list changes (new message,
	// chat switch, reconnect resync). Referencing chat.messages tracks any reassignment.
	$effect(() => {
		chat.messages;
		if (el) el.scrollTop = el.scrollHeight;
	});
</script>

<div class="messages" bind:this={el}>
	{#if chat.loadingMessages}
		<p class="loading-msg">Loading…</p>
	{:else if chat.messages.length === 0}
		<p class="loading-msg">No messages yet. Say hello!</p>
	{:else}
		{#each chat.messages as msg (msg.id)}
			{#if isSystem(msg)}
				<div class="system-notice">{msg.text}</div>
			{:else}
				<div class="message-row" class:mine={isMine(msg)}>
					<div class="bubble" class:bubble-mine={isMine(msg)}>
						<span class="bubble-text">{msg.text}</span>
						<span class="bubble-time">{formatTime(msg.created_at)}</span>
					</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>

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
		.loading-msg {
			color: rgba(255, 255, 255, 0.35);
		}
		.system-notice {
			background: rgba(255, 255, 255, 0.07);
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
	}
</style>
