<script lang="ts">
	import { getAvatarColor } from '$lib/utils/avatar';

	let { name, size = 40 }: { name: string; size?: number } = $props();

	const initial = $derived((name || '?').charAt(0).toUpperCase());
</script>

<div
	class="avatar"
	style="width: {size}px; height: {size}px; font-size: {Math.round(size * 0.4)}px; background: {getAvatarColor(name)}"
>
	{initial}
</div>

<style>
	.avatar {
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		color: #fff;
		flex-shrink: 0;
	}
</style>
