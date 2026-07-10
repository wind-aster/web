<script lang="ts">
	import { Button } from 'svelte-fluentui';
	import { chat } from '$lib/stores/chat.svelte';
	import Avatar from './Avatar.svelte';
</script>

<div class="search-bar">
	<!-- svelte-ignore a11y_autofocus -->
	<input
		class="search-input"
		type="text"
		placeholder="Search users…"
		bind:value={chat.userQuery}
		autofocus
	/>
	<button class="back-btn" onclick={() => chat.closePanel()}>Back</button>
</div>

{#if chat.panelMode === 'group'}
	<div class="group-setup">
		<input
			class="search-input"
			type="text"
			placeholder="Group name…"
			bind:value={chat.groupName}
		/>
		{#if chat.groupSelected.length > 0}
			<div class="chips">
				{#each chat.groupSelected as user (user.id)}
					{@const label = user.display_name || user.username}
					<button class="chip" onclick={() => chat.toggleUser(user)}>
						{label}<span class="chip-x">×</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<div class="chat-list">
	{#if chat.usersLoading}
		<p class="empty-chats">Loading users…</p>
	{:else if chat.filteredUsers.length === 0}
		<p class="empty-chats">No users found</p>
	{:else}
		{#each chat.filteredUsers as user (user.id)}
			{@const label = user.display_name || user.username}
			<button
				class="chat-item"
				class:selected={chat.panelMode === 'group' && chat.isSelected(user)}
				onclick={() => (chat.panelMode === 'group' ? chat.toggleUser(user) : chat.startDM(user))}
			>
				<Avatar name={label} size={40} />
				<div class="chat-info">
					<div class="chat-item-row">
						<span class="chat-name">{label}</span>
					</div>
					<span class="chat-preview">@{user.username}</span>
				</div>
				{#if chat.panelMode === 'group' && chat.isSelected(user)}
					<span class="check">✓</span>
				{/if}
			</button>
		{/each}
	{/if}
</div>

{#if chat.panelMode === 'group'}
	<div class="group-footer">
		<Button
			appearance="accent"
			onclick={() => chat.createGroup()}
			disabled={!chat.groupName.trim() || chat.groupSelected.length === 0}
			style="width: 100%"
		>
			Create group
		</Button>
	</div>
{/if}

<style>
	.search-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 12px 10px;
	}

	.search-input {
		flex: 1;
		min-width: 0;
		height: 32px;
		padding: 0 12px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: #ffffff;
		font-size: 13px;
		color: #1f1f1f;
		outline: none;
		transition: border-color 0.15s;
	}

	.search-input:focus {
		border-color: #3eb489;
	}

	.search-input::placeholder {
		color: rgba(0, 0, 0, 0.4);
	}

	.back-btn {
		border: none;
		background: none;
		cursor: pointer;
		font-size: 13px;
		color: #3eb489;
		padding: 4px 6px;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.back-btn:hover {
		background: rgba(62, 180, 137, 0.12);
	}

	.group-setup {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 12px 10px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		border: none;
		border-radius: 12px;
		background: rgba(62, 180, 137, 0.16);
		color: #2f8f6c;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.chip:hover {
		background: rgba(62, 180, 137, 0.26);
	}

	.chip-x {
		font-size: 14px;
		line-height: 1;
	}

	.group-footer {
		padding: 12px;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		flex-shrink: 0;
	}

	/* ── Shared list primitives (also in ChatList, scoped per component) ── */
	.chat-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 8px;
	}

	.empty-chats {
		margin: 24px 8px;
		font-size: 13px;
		color: rgba(0, 0, 0, 0.4);
		text-align: center;
	}

	.chat-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border: none;
		background: none;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition: background 0.12s;
		color: inherit;
	}

	.chat-item:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.chat-item.selected {
		background: rgba(62, 180, 137, 0.12);
	}

	.chat-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.chat-item-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px;
	}

	.chat-name {
		font-size: 14px;
		font-weight: 500;
		color: #1f1f1f;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chat-preview {
		font-size: 12px;
		color: rgba(0, 0, 0, 0.5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.check {
		margin-left: auto;
		color: #3eb489;
		font-size: 15px;
		font-weight: 700;
		flex-shrink: 0;
	}

	@media (prefers-color-scheme: dark) {
		.search-input {
			background: #23232b;
			border-color: rgba(255, 255, 255, 0.12);
			color: #e8e8ea;
		}
		.search-input::placeholder {
			color: rgba(255, 255, 255, 0.35);
		}
		.chip {
			background: rgba(62, 180, 137, 0.22);
			color: #6fd3ac;
		}
		.chip:hover {
			background: rgba(62, 180, 137, 0.32);
		}
		.group-footer {
			border-top-color: rgba(255, 255, 255, 0.07);
		}
		.empty-chats {
			color: rgba(255, 255, 255, 0.35);
		}
		.chat-item:hover {
			background: rgba(255, 255, 255, 0.05);
		}
		.chat-item.selected {
			background: rgba(62, 180, 137, 0.18);
		}
		.chat-name {
			color: #e8e8ea;
		}
		.chat-preview {
			color: rgba(255, 255, 255, 0.45);
		}
	}
</style>
