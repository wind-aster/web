<script module lang="ts">
	export interface MediaItem {
		id: number;
		url: string;
		filename: string;
		type: 'image' | 'video';
		poster?: string;
	}
</script>

<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	interface Props {
		items: MediaItem[];
		index: number;
		onclose: () => void;
	}

	let { items, index, onclose }: Props = $props();

	// Intentionally captures the initial index; the component remounts on each open.
	// svelte-ignore state_referenced_locally
	let current = $state(index);
	const item = $derived(items[current] ?? null);
	const hasPrev = $derived(current > 0);
	const hasNext = $derived(current < items.length - 1);

	function prev() {
		if (hasPrev) current -= 1;
	}
	function next() {
		if (hasNext) current += 1;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	// Lock background scroll while the viewer is open.
	$effect(() => {
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prevOverflow;
		};
	});

	async function download() {
		if (!item) return;
		try {
			// Fetch → blob → <a download> forces a save with the right filename even
			// though the object is served with an inline Content-Disposition.
			const res = await fetch(item.url);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = item.filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch {
			window.open(item.url, '_blank', 'noopener');
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if item}
	<div class="overlay" role="dialog" aria-modal="true" aria-label={item.filename}>
		<button
			class="backdrop"
			aria-label="Close media viewer"
			onclick={onclose}
			transition:fade={{ duration: 150 }}
		></button>

		<div class="topbar">
			{#if items.length > 1}
				<span class="counter">{current + 1} / {items.length}</span>
			{/if}
			<button class="tool" title="Download" aria-label="Download" onclick={download}>
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
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<path d="M7 10l5 5 5-5" />
					<path d="M12 15V3" />
				</svg>
			</button>
			<button class="tool" title="Close" aria-label="Close" onclick={onclose}>
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
		</div>

		{#if hasPrev}
			<button class="nav prev" title="Previous" aria-label="Previous" onclick={prev}>
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m15 18-6-6 6-6" />
				</svg>
			</button>
		{/if}
		{#if hasNext}
			<button class="nav next" title="Next" aria-label="Next" onclick={next}>
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</button>
		{/if}

		<!-- Keyed so navigating remounts the media (and re-triggers video autoplay). -->
		{#key current}
			{#if item.type === 'video'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					class="media"
					src={item.url}
					poster={item.poster}
					controls
					autoplay
					playsinline
					transition:scale={{ duration: 180, start: 0.9 }}
				></video>
			{:else}
				<img
					class="media"
					src={item.url}
					alt={item.filename}
					transition:scale={{ duration: 180, start: 0.9 }}
				/>
			{/if}
		{/key}
	</div>
{/if}

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

	.topbar {
		position: absolute;
		top: 16px;
		right: 16px;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.counter {
		color: rgba(255, 255, 255, 0.75);
		font-size: 13px;
		margin-right: 4px;
	}

	.tool {
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

	.tool:hover {
		background: rgba(255, 255, 255, 0.22);
	}

	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		cursor: pointer;
		transition: background 0.15s;
	}

	.nav:hover {
		background: rgba(255, 255, 255, 0.22);
	}

	.nav.prev {
		left: 16px;
	}

	.nav.next {
		right: 16px;
	}
</style>
