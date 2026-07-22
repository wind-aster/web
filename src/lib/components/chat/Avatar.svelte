<script lang="ts">
	import { getAvatarColor } from '$lib/utils/avatar';

	let { name, size = 40, online }: { name: string; size?: number; online?: boolean } = $props();

	const initial = $derived((name || '?').charAt(0).toUpperCase());
</script>

<div class="avatar-wrap" style="width: {size}px; height: {size}px;">
	<div
		class="avatar"
		style="font-size: {Math.round(size * 0.4)}px; background: {getAvatarColor(name)}"
	>
		{initial}
	</div>
	{#if online}
		<span
			class="online-dot"
			style="width: {Math.max(8, size * 0.28)}px; height: {Math.max(8, size * 0.28)}px;"
		></span>
	{/if}
</div>

<style>
	.avatar-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		color: #fff;
	}

	.online-dot {
		position: absolute;
		right: 0;
		bottom: 0;
		border-radius: 50%;
		background: #3eb489;
		border: 2px solid #ffffff;
		box-sizing: border-box;
	}

	@media (prefers-color-scheme: dark) {
		.online-dot {
			border-color: #1e1e24;
		}
	}
</style>
