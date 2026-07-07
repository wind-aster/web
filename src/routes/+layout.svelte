<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from 'svelte-fluentui';
	import 'svelte-fluentui/styles';

	let { children } = $props();

	$effect(() => {
		theme.init();
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
		background-color: var(--colorNeutralBackground1);
		color: var(--colorNeutralForeground1);
		font-family: var(--fontFamilyBase);
	}
</style>
