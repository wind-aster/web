<script lang="ts">
	import { TextField } from 'svelte-fluentui';
	import { chat } from '$lib/stores/chat.svelte';

	let inputText = $state('');
	const canSend = $derived(inputText.trim().length > 0);

	async function send() {
		const text = inputText.trim();
		if (!text) return;
		if (await chat.sendMessage(text)) inputText = '';
	}
</script>

<div class="input-area">
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
	<button class="send-btn" onclick={send} disabled={!canSend} title="Send" aria-label="Send message">
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

<style>
	.input-area {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		background: #ffffff;
		flex-shrink: 0;
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
		transition: background 0.15s, transform 0.1s;
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
		.input-area {
			background: #1e1e24;
			border-top-color: rgba(255, 255, 255, 0.07);
		}
		.send-btn:disabled {
			background: rgba(255, 255, 255, 0.1);
			color: rgba(255, 255, 255, 0.35);
		}
	}
</style>
