<script lang="ts">
	import { notifications } from '$lib/stores/notifications.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	const blocked = $derived(notifications.permission === 'denied');
	// "On" = permission granted and alerts enabled; drives the filled vs muted icon.
	const on = $derived(notifications.permission === 'granted' && notifications.enabled);

	const title = $derived(
		blocked
			? 'Notifications blocked in your browser'
			: notifications.permission === 'default'
				? 'Enable notifications'
				: on
					? 'Notifications on — click to mute'
					: 'Notifications muted — click to enable'
	);

	function onClick() {
		if (blocked) {
			// Can't re-prompt once the browser has blocked us — explain the way back.
			toast.info(
				'Notifications are blocked for this site. Re-enable them in your browser’s site settings to get alerts.'
			);
			return;
		}
		if (notifications.permission === 'default') {
			notifications.requestPermission();
		} else {
			notifications.toggleEnabled();
		}
	}
</script>

{#if notifications.supported}
	<button class="icon-btn" class:muted={!on} onclick={onClick} {title}>
		{#if on}
			<!-- Filled/active bell -->
			<svg
				width="18"
				height="18"
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M8 2a3.5 3.5 0 0 0-3.5 3.5c0 2.5-.9 3.6-1.4 4.1-.2.2-.3.3-.3.6 0 .4.3.6.7.6h9c.4 0 .7-.2.7-.6 0-.3-.1-.4-.3-.6-.5-.5-1.4-1.6-1.4-4.1A3.5 3.5 0 0 0 8 2Z"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linejoin="round"
				/>
				<path
					d="M6.6 13a1.5 1.5 0 0 0 2.8 0"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
				/>
			</svg>
		{:else}
			<!-- Muted bell with a slash -->
			<svg
				width="18"
				height="18"
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M8 2a3.5 3.5 0 0 0-3.5 3.5c0 2.5-.9 3.6-1.4 4.1-.2.2-.3.3-.3.6 0 .4.3.6.7.6h9c.4 0 .7-.2.7-.6 0-.3-.1-.4-.3-.6-.5-.5-1.4-1.6-1.4-4.1A3.5 3.5 0 0 0 8 2Z"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linejoin="round"
				/>
				<path
					d="M6.6 13a1.5 1.5 0 0 0 2.8 0"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
				/>
				<path d="M2.5 2.5l11 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
			</svg>
		{/if}
	</button>
{/if}

<style>
	.icon-btn {
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
		transition:
			background 0.15s,
			color 0.15s;
		padding: 0;
	}

	.icon-btn:hover {
		background: rgba(0, 0, 0, 0.07);
		color: rgba(0, 0, 0, 0.8);
	}

	.icon-btn:not(.muted) {
		color: #3eb489;
	}

	@media (prefers-color-scheme: dark) {
		.icon-btn {
			color: rgba(255, 255, 255, 0.4);
		}
		.icon-btn:hover {
			background: rgba(255, 255, 255, 0.07);
			color: rgba(255, 255, 255, 0.85);
		}
		.icon-btn:not(.muted) {
			color: #3eb489;
		}
	}
</style>
