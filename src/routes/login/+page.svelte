<script lang="ts">
	import { Button, Field, TextField } from 'svelte-fluentui';
	import { login as apiLogin } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let identifier = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			const res = await apiLogin(identifier, password);
			auth.login(res.access_token, res.refresh_token, res.user);
			goto(resolve('/app'), { replaceState: true });
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
				autocomplete="current-password"
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
			{loading ? 'Signing in…' : 'Sign in'}
		</Button>

		<p class="switch">Don't have an account? <a href={resolve('/register')}>Register</a></p>
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
		color: #1f1f1f;
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
			color: #e8e8ea;
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
		color: #d13438;
	}

	.switch {
		margin: 0;
		text-align: center;
		font-size: 13px;
		color: rgba(0, 0, 0, 0.5);
	}

	.switch a {
		color: var(--fluent-accent-primary, #3eb489);
		text-decoration: none;
	}

	@media (prefers-color-scheme: dark) {
		.error {
			color: #ff8a90;
		}

		.switch {
			color: rgba(255, 255, 255, 0.5);
		}
	}
</style>
