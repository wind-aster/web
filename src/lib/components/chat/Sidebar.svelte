<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { chat } from '$lib/stores/chat.svelte';
	import Avatar from './Avatar.svelte';
	import ChatList from './ChatList.svelte';
	import NewChatPanel from './NewChatPanel.svelte';
	import NotificationBell from './NotificationBell.svelte';

	let { onLogout }: { onLogout: () => void } = $props();
</script>

<aside class="sidebar">
	<div class="sidebar-top">
		<span class="logo">WindAster</span>
		<div class="top-actions">
			<NotificationBell />
			<button class="icon-btn" onclick={() => chat.openDM()} title="New chat">
				<svg
					width="18"
					height="18"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M8 3.5v9M3.5 8h9"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</svg>
			</button>
			<button class="icon-btn" onclick={() => chat.openGroup()} title="New group">
				<svg
					width="18"
					height="18"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M10.5 8a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM13.5 13v-.5a2.5 2.5 0 0 0-2.5-2.5h-1M5.5 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2 13.5V13a2.5 2.5 0 0 1 2.5-2.5h2A2.5 2.5 0 0 1 9 13v.5"
						stroke="currentColor"
						stroke-width="1.3"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<button class="icon-btn" onclick={onLogout} title="Sign out">
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>

	<div class="user-row">
		<Avatar name={auth.user?.username ?? 'me'} size={32} />
		<span class="user-name">{auth.user?.username || 'Me'}</span>
	</div>

	{#if chat.panelMode !== 'none'}
		<NewChatPanel />
	{:else}
		<ChatList />
	{/if}
</aside>

<style>
	.sidebar {
		width: 280px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: #f5f5f7;
		border-right: 1px solid rgba(0, 0, 0, 0.08);
		overflow: hidden;
	}

	.sidebar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 16px 10px;
	}

	.logo {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.3px;
		color: #3eb489;
	}

	.top-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		border-radius: 6px;
		cursor: pointer;
		color: rgba(0, 0, 0, 0.45);
		transition:
			background 0.15s,
			color 0.15s;
		padding: 0;
	}

	.icon-btn:hover {
		background: rgba(0, 0, 0, 0.07);
		color: rgba(0, 0, 0, 0.8);
	}

	.user-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px 12px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		margin-bottom: 4px;
	}

	.user-name {
		font-size: 13px;
		font-weight: 500;
		color: #1f1f1f;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (prefers-color-scheme: dark) {
		.sidebar {
			background: #18181e;
			border-right-color: rgba(255, 255, 255, 0.07);
		}
		.icon-btn {
			color: rgba(255, 255, 255, 0.4);
		}
		.icon-btn:hover {
			background: rgba(255, 255, 255, 0.07);
			color: rgba(255, 255, 255, 0.85);
		}
		.user-row {
			border-bottom-color: rgba(255, 255, 255, 0.06);
		}
		.user-name {
			color: #e8e8ea;
		}
	}
</style>
