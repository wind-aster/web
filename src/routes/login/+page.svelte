<script lang="ts">
	import { Button, Field, TextField } from 'svelte-fluentui';
	import { login as apiLogin } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';

	let identifier = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			const res = await apiLogin(identifier, password);
			auth.login(res.token, res.user);
			goto('/app', { replaceState: true });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="page">
	<div class="card">
		<h1>WindAster</h1>
		<p class="subtitle">Sign in to continue</p>

		<Field label="Username or Email" id="identifier">
			<TextField
				id="identifier"
				placeholder="Username or Email"
				bind:value={identifier}
				required
				autocomplete="username"
			/>
		</Field>

		<Field label="Password" id="password">
			<TextField
				id="password"
				type="password"
				placeholder="Password"
				bind:value={password}
				required
				autocomplete="current-password"
				onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
			/>
		</Field>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<Button appearance="accent" onclick={handleSubmit} disabled={loading}>
			{loading ? 'Signing in…' : 'Sign in'}
		</Button>

		<p class="switch">Don't have an account? <a href="/register">Register</a></p>
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 100%;
		max-width: 360px;
		padding: 36px 32px;
		border-radius: 8px;
		background: var(--colorNeutralBackground2);
	}

	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.3px;
	}

	.subtitle {
		margin: -6px 0 4px;
		font-size: 13px;
		color: var(--colorNeutralForeground2);
	}

	.error {
		margin: 0;
		font-size: 12px;
		color: var(--colorPaletteRedForeground1);
	}

	.switch {
		margin: 0;
		text-align: center;
		font-size: 13px;
		color: var(--colorNeutralForeground2);
	}

	.switch a {
		color: var(--colorBrandForeground1);
		text-decoration: none;
	}
</style>
