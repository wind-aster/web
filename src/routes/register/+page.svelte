<script lang="ts">
	import { Button, Field, TextField } from 'svelte-fluentui';
	import { register as apiRegister } from '$lib/api/auth';
	import { goto } from '$app/navigation';

	let email = $state('');
	let username = $state('');
	let displayName = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			await apiRegister(email, username, displayName, password);
			goto('/login', { replaceState: true });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="page">
	<div class="card">
		<h1>WindAster</h1>
		<p class="subtitle">Create your account</p>

		<Field label="Email" id="email">
			<TextField
				id="email"
				type="email"
				placeholder="you@example.com"
				bind:value={email}
				required
				autocomplete="email"
			/>
		</Field>

		<Field label="Username" id="username">
			<TextField
				id="username"
				placeholder="username"
				bind:value={username}
				required
				autocomplete="username"
			/>
		</Field>

		<Field label="Display name" id="display-name">
			<TextField
				id="display-name"
				placeholder="Your Name"
				bind:value={displayName}
				required
				autocomplete="name"
			/>
		</Field>

		<Field label="Password" id="password">
			<TextField
				id="password"
				type="password"
				placeholder="Password"
				bind:value={password}
				required
				autocomplete="new-password"
				onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
			/>
		</Field>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<Button appearance="accent" onclick={handleSubmit} disabled={loading}>
			{loading ? 'Creating account…' : 'Create account'}
		</Button>

		<p class="switch">Already have an account? <a href="/login">Sign in</a></p>
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
