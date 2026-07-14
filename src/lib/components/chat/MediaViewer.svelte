<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	interface Props {
		src: string;
		filename: string;
		type: 'image' | 'video';
		poster?: string;
		onclose: () => void;
	}

	let { src, filename, type, poster, onclose }: Props = $props();

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	// Lock background scroll while the viewer is open.
	$effect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Backdrop is a button so the click-to-dismiss hit area is keyboard-accessible. -->
<div class="overlay" role="dialog" aria-modal="true" aria-label={filename}>
	<button
		class="backdrop"
		aria-label="Close media viewer"
		onclick={onclose}
		transition:fade={{ duration: 150 }}
	></button>

	<button class="close" title="Close" aria-label="Close" onclick={onclose}>
		<svg
			width="22"
			height="22"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</svg>
	</button>

	<!-- The backdrop is a sibling behind the media, not an ancestor, so clicks on
	     the media (or its controls) don't reach it — clicking the dark margin closes. -->
	{#if type === 'video'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			class="media"
			{src}
			{poster}
			controls
			autoplay
			playsinline
			transition:scale={{ duration: 180, start: 0.9 }}
		></video>
	{:else}
		<img class="media" {src} alt={filename} transition:scale={{ duration: 180, start: 0.9 }} />
	{/if}
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		border: none;
		padding: 0;
		margin: 0;
		background: rgba(0, 0, 0, 0.85);
		cursor: zoom-out;
	}

	.media {
		position: relative;
		max-width: 92vw;
		max-height: 92vh;
		width: auto;
		height: auto;
		border-radius: 6px;
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
		cursor: default;
	}

	.close {
		position: absolute;
		top: 16px;
		right: 16px;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		cursor: pointer;
		transition: background 0.15s;
	}

	.close:hover {
		background: rgba(255, 255, 255, 0.22);
	}
</style>
