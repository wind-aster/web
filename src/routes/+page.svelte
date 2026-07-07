<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';

	$effect(() => {
		goto(auth.isAuthenticated ? '/app' : '/login', { replaceState: true });
	});
</script>
