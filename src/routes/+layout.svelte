<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { theme, settings } from 'svelte-fluentui';
	import 'svelte-fluentui/styles';

	let { children } = $props();

	$effect(() => {
		settings.setAccentColor('#3EB489');

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const apply = () => theme.set(mq.matches ? 'dark' : 'light');
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	});
</script>

<svelte:head>
	<title>WindAster</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		background-color: var(--neutral-layer-1, transparent);
		color: var(--neutral-foreground-rest, inherit);
		font-family: var(--fontFamilyBase);
	}
</style>
