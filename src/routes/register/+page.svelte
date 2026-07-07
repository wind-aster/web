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
				style="width: 100%"
			/>
		</Field>

		<Field label="Username" id="username">
			<TextField
				id="username"
				placeholder="username"
				bind:value={username}
				required
				autocomplete="username"
				style="width: 100%"
			/>
		</Field>

		<Field label="Display name" id="display-name">
			<TextField
				id="display-name"
				placeholder="Your Name"
				bind:value={displayName}
				required
				autocomplete="name"
				style="width: 100%"
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
				style="width: 100%"
				onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
			/>
		</Field>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<Button
			appearance="accent"
			onclick={handleSubmit}
			disabled={loading}
			style="width: 100%; margin-top: 4px"
		>
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
		background: #e2e2e6;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 100%;
		max-width: 380px;
		padding: 40px 36px;
		border-radius: 12px;
		background: #ffffff;
		box-shadow:
			0 4px 16px rgba(0, 0, 0, 0.08),
			0 1px 3px rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(0, 0, 0, 0.06);
	}

	@media (prefers-color-scheme: dark) {
		.page {
			background: #0e0e10;
		}

		.card {
			background: #1e1e24;
			border-color: rgba(255, 255, 255, 0.07);
			box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		}
	}

	h1 {
		margin: 0;
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.4px;
		color: var(--fluent-accent-primary, #3eb489);
	}

	.subtitle {
		margin: -6px 0 4px;
		font-size: 13px;
		opacity: 0.6;
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
		color: #aeafb4;
	}

	.switch a {
		color: var(--fluent-accent-primary, #3eb489);
		text-decoration: none;
	}
</style>
