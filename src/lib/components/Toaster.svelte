<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toast } from '$lib/stores/toast.svelte';
</script>

<div class="toaster" aria-live="polite">
	{#each toast.items as t (t.id)}
		<button
			class="toast {t.type}"
			onclick={() => toast.dismiss(t.id)}
			transition:fly={{ y: 12, duration: 180 }}
			title="Dismiss"
		>
			{t.message}
		</button>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1100;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}

	.toast {
		pointer-events: auto;
		max-width: 90vw;
		padding: 10px 16px;
		border: none;
		border-radius: 10px;
		font-size: 13px;
		color: #ffffff;
		background: #333340;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		text-align: left;
	}

	.toast.error {
		background: #e74c3c;
	}

	.toast.success {
		background: #3eb489;
	}
</style>
