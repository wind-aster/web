<script lang="ts">
	import { chat } from '$lib/stores/chat.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { formatLastSeen } from '$lib/utils/format';
	import type { ChatDetail } from '$lib/api/chats';
	import Avatar from './Avatar.svelte';

	let { selectedChat }: { selectedChat: ChatDetail } = $props();

	const name = $derived(chat.chatName(selectedChat));

	// The other participant in a DM (used for presence + the online dot).
	const other = $derived(
		selectedChat.type === 'direct'
			? (selectedChat.members.find((m) => m.id !== auth.userId) ?? null)
			: null
	);
	const otherPresence = $derived(other ? chat.presenceFor(other.id) : { online: false });

	// Names of members currently typing in this chat (excludes me).
	const typingNames = $derived(
		chat.typingUserIds(selectedChat.id).map((id) => {
			const m = selectedChat.members.find((mm) => mm.id === id);
			return m?.display_name || m?.username || 'Someone';
		})
	);

	const status = $derived.by(() => {
		if (typingNames.length > 0) {
			return selectedChat.type === 'group' ? `${typingNames.join(', ')} typing…` : 'typing…';
		}
		if (selectedChat.type === 'group') return `${selectedChat.members.length} members`;
		if (otherPresence.online) return 'online';
		return formatLastSeen(otherPresence.last_seen);
	});
</script>

<div class="chat-header">
	<Avatar {name} size={36} online={otherPresence.online} />
	<div class="header-info">
		<span class="header-name">{name}</span>
		<span class="header-sub" class:typing={typingNames.length > 0}>{status}</span>
	</div>
</div>

<style>
	.chat-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		flex-shrink: 0;
		background: #ffffff;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.header-name {
		font-size: 15px;
		font-weight: 600;
		color: #1f1f1f;
	}

	.header-sub {
		font-size: 12px;
		color: rgba(0, 0, 0, 0.5);
	}

	.header-sub.typing {
		color: var(--fluent-accent-primary, #3eb489);
		font-style: italic;
	}

	@media (prefers-color-scheme: dark) {
		.chat-header {
			background: #1e1e24;
			border-bottom-color: rgba(255, 255, 255, 0.07);
		}
		.header-name {
			color: #e8e8ea;
		}
		.header-sub {
			color: rgba(255, 255, 255, 0.45);
		}
	}
</style>
