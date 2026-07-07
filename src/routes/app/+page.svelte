<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';

	$effect(() => {
		if (!auth.isAuthenticated) {
			goto('/login', { replaceState: true });
		}
	});
</script>
