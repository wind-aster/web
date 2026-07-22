import { auth } from '$lib/stores/auth.svelte';
import { SYSTEM_USER_ID } from '$lib/constants';
import {
	getChats,
	createChat,
	type ChatDetail,
	type ChatMember,
	type Message
} from '$lib/api/chats';
import {
	getMessages,
	sendMessageRest,
	editMessage as apiEditMessage,
	deleteMessage as apiDeleteMessage
} from '$lib/api/messages';
import { getUsers } from '$lib/api/users';
import { connectWS, sendWS, disconnectWS } from '$lib/api/ws';
import { ensureFreshAccess } from '$lib/api/client';

function lastActivity(chat: ChatDetail): number {
	const last = chat.last_messages.at(-1);
	return last ? new Date(last.created_at).getTime() : 0;
}

const PAGE = 50;

function createChatStore() {
	let chats = $state<ChatDetail[]>([]);
	let selectedChatId = $state<number | null>(null);
	let messages = $state<Message[]>([]);
	let loadingMessages = $state(false);
	let hasMoreOlder = $state(false);
	let loadingOlder = $state(false);

	// Composer intent: replying to / editing an existing message (mutually exclusive).
	let replyingTo = $state<Message | null>(null);
	let editingId = $state<number | null>(null);
	let editingText = $state('');

	// User search / new chat panel
	let panelMode = $state<'none' | 'dm' | 'group'>('none');
	let userQuery = $state('');
	let allUsers = $state<ChatMember[]>([]);
	let usersLoading = $state(false);

	// Group creation
	let groupName = $state('');
	let groupSelected = $state<ChatMember[]>([]);

	const selectedChat = $derived(chats.find((c) => c.id === selectedChatId) ?? null);

	const sortedChats = $derived.by(() =>
		[...chats].sort((a, b) => lastActivity(b) - lastActivity(a) || b.id - a.id)
	);

	const filteredUsers = $derived.by(() => {
		const q = userQuery.trim().toLowerCase();
		return allUsers.filter((u) => {
			if (u.id === SYSTEM_USER_ID) return false;
			if (u.id === auth.userId) return false;
			if (!q) return true;
			return (
				u.username.toLowerCase().includes(q) || (u.display_name ?? '').toLowerCase().includes(q)
			);
		});
	});

	async function refreshChats() {
		if (!auth.token) return;
		chats = (await getChats()) ?? [];
	}

	async function selectChat(id: number) {
		if (selectedChatId === id) return;
		selectedChatId = id;
		messages = [];
		hasMoreOlder = false;
		loadingMessages = true;
		try {
			if (auth.token) {
				const data = await getMessages(id, PAGE);
				// Guard against a stale fetch resolving after the user switched chats.
				if (selectedChatId === id) {
					messages = data ?? [];
					hasMoreOlder = (data?.length ?? 0) === PAGE;
				}
			}
		} finally {
			if (selectedChatId === id) loadingMessages = false;
		}
	}

	// Load an older page and prepend it (infinite scroll upward).
	async function loadOlder() {
		if (loadingOlder || !hasMoreOlder || selectedChatId === null || !auth.token) return;
		const chatId = selectedChatId;
		const before = messages[0]?.id;
		if (before === undefined) return;
		loadingOlder = true;
		try {
			const older = await getMessages(chatId, PAGE, before);
			if (selectedChatId !== chatId) return; // switched away mid-fetch
			if (older && older.length > 0) messages = [...older, ...messages];
			hasMoreOlder = (older?.length ?? 0) === PAGE;
		} finally {
			if (selectedChatId === chatId) loadingOlder = false;
		}
	}

	async function sendMessage(
		rawText: string,
		attachmentIds: number[] = [],
		replyToId?: number
	): Promise<boolean> {
		const text = rawText.trim();
		if ((!text && attachmentIds.length === 0) || selectedChatId === null) return false;
		const chatId = selectedChatId;

		if (sendWS(chatId, text, attachmentIds, replyToId)) return true;

		// WS not connected — fall back to REST and add optimistically.
		if (!auth.token) return false;
		try {
			const res = await sendMessageRest(chatId, text, attachmentIds, replyToId);
			const sentMsg: Message = {
				id: res.message_id,
				sender_id: auth.userId ?? 0,
				chat_id: chatId,
				text,
				created_at: res.created_at,
				attachments: res.attachments,
				reply_to_id: replyToId,
				reply_preview: res.reply_preview
			};
			if (selectedChatId === chatId) messages = [...messages, sentMsg];
			chats = chats.map((c) =>
				c.id === chatId ? { ...c, last_messages: [...c.last_messages.slice(-4), sentMsg] } : c
			);
			return true;
		} catch (e) {
			console.error('Send failed', e);
			return false;
		}
	}

	// --- Reply / edit intent -------------------------------------------------

	function startReply(msg: Message) {
		cancelEdit();
		replyingTo = msg;
	}
	function cancelReply() {
		replyingTo = null;
	}

	function startEdit(msg: Message) {
		cancelReply();
		editingId = msg.id;
		editingText = msg.text;
	}
	function cancelEdit() {
		editingId = null;
		editingText = '';
	}

	// Submit an edit for the message currently in edit mode. Optimistically
	// updates locally; the broadcast reconciles for every client.
	async function submitEdit(rawText: string): Promise<boolean> {
		const text = rawText.trim();
		const id = editingId;
		if (id === null || !text) return false;
		try {
			const updated = await apiEditMessage(id, text);
			applyUpdatedMessage(updated);
			cancelEdit();
			return true;
		} catch (e) {
			console.error('Edit failed', e);
			return false;
		}
	}

	async function removeMessage(id: number): Promise<void> {
		try {
			await apiDeleteMessage(id);
			applyDeletedMessage(selectedChatId ?? -1, id);
		} catch (e) {
			console.error('Delete failed', e);
		}
	}

	function loadUsers() {
		if (allUsers.length === 0 && auth.token) {
			usersLoading = true;
			getUsers()
				.then((data) => {
					allUsers = data ?? [];
				})
				.finally(() => {
					usersLoading = false;
				});
		}
	}

	function closePanel() {
		panelMode = 'none';
		userQuery = '';
		groupName = '';
		groupSelected = [];
	}

	async function startDM(user: ChatMember) {
		const existing = chats.find(
			(c) => c.type === 'direct' && c.members.some((m) => m.id === user.id)
		);
		if (existing) {
			closePanel();
			selectChat(existing.id);
			return;
		}

		if (!auth.token || auth.userId === null) return;
		const chatId = await createChat(user.username, 'direct', [auth.userId, user.id]);
		await refreshChats();
		closePanel();
		selectChat(chatId);
	}

	function isSelected(user: ChatMember): boolean {
		return groupSelected.some((u) => u.id === user.id);
	}

	function toggleUser(user: ChatMember) {
		if (isSelected(user)) {
			groupSelected = groupSelected.filter((u) => u.id !== user.id);
		} else {
			groupSelected = [...groupSelected, user];
		}
	}

	async function createGroup() {
		const name = groupName.trim();
		if (!name || groupSelected.length === 0 || !auth.token || auth.userId === null) return;
		const ids = [auth.userId, ...groupSelected.map((u) => u.id)];
		const chatId = await createChat(name, 'group', ids);
		await refreshChats();
		closePanel();
		selectChat(chatId);
	}

	function chatName(chat: ChatDetail): string {
		if (chat.type === 'direct') {
			const other = chat.members.find((m) => m.id !== auth.userId);
			return other?.display_name || other?.username || chat.title;
		}
		return chat.title;
	}

	function onMessage(msg: Message) {
		if (msg.chat_id === selectedChatId) {
			messages = [...messages, msg];
		}
		if (chats.some((c) => c.id === msg.chat_id)) {
			chats = chats.map((c) =>
				c.id === msg.chat_id ? { ...c, last_messages: [...c.last_messages.slice(-4), msg] } : c
			);
		} else {
			// Message for a chat we aren't tracking yet (new DM/group) — pull it in.
			refreshChats();
		}
	}

	// Replace a message in the open thread and refresh the sidebar preview.
	function applyUpdatedMessage(msg: Message) {
		if (msg.chat_id === selectedChatId) {
			messages = messages.map((m) => (m.id === msg.id ? msg : m));
		}
		chats = chats.map((c) =>
			c.id === msg.chat_id
				? { ...c, last_messages: c.last_messages.map((m) => (m.id === msg.id ? msg : m)) }
				: c
		);
	}

	// Remove a message from the open thread; if it was a sidebar preview, resync.
	function applyDeletedMessage(chatId: number, id: number) {
		if (chatId === selectedChatId) {
			messages = messages.filter((m) => m.id !== id);
		}
		// If the deleted message was a chat's last message, recompute the preview.
		if (chats.some((c) => c.last_messages.some((m) => m.id === id))) {
			refreshChats();
		}
	}

	function onMessageUpdated(msg: Message) {
		applyUpdatedMessage(msg);
	}

	function onMessageDeleted(chatId: number, id: number) {
		applyDeletedMessage(chatId, id);
	}

	function onReconnected() {
		// Reconnected after a drop — resync anything missed while offline.
		refreshChats();
		if (selectedChatId !== null && auth.token) {
			const id = selectedChatId;
			getMessages(id, PAGE).then((data) => {
				if (selectedChatId === id) {
					messages = data ?? [];
					hasMoreOlder = (data?.length ?? 0) === PAGE;
				}
			});
		}
	}

	function start() {
		getChats().then((data) => {
			chats = data ?? [];
		});
		connectWS(ensureFreshAccess, { onMessage, onMessageUpdated, onMessageDeleted }, onReconnected);
	}

	function stop() {
		disconnectWS();
	}

	return {
		get chats() {
			return chats;
		},
		get sortedChats() {
			return sortedChats;
		},
		get selectedChat() {
			return selectedChat;
		},
		get selectedChatId() {
			return selectedChatId;
		},
		get messages() {
			return messages;
		},
		get loadingMessages() {
			return loadingMessages;
		},
		get hasMoreOlder() {
			return hasMoreOlder;
		},
		get loadingOlder() {
			return loadingOlder;
		},
		loadOlder,
		get replyingTo() {
			return replyingTo;
		},
		get editingId() {
			return editingId;
		},
		get editingText() {
			return editingText;
		},
		startReply,
		cancelReply,
		startEdit,
		cancelEdit,
		submitEdit,
		removeMessage,
		get panelMode() {
			return panelMode;
		},
		get userQuery() {
			return userQuery;
		},
		set userQuery(v: string) {
			userQuery = v;
		},
		get groupName() {
			return groupName;
		},
		set groupName(v: string) {
			groupName = v;
		},
		get groupSelected() {
			return groupSelected;
		},
		get filteredUsers() {
			return filteredUsers;
		},
		get usersLoading() {
			return usersLoading;
		},
		openDM() {
			panelMode = 'dm';
			loadUsers();
		},
		openGroup() {
			panelMode = 'group';
			loadUsers();
		},
		closePanel,
		startDM,
		isSelected,
		toggleUser,
		createGroup,
		selectChat,
		sendMessage,
		refreshChats,
		chatName,
		start,
		stop
	};
}

export const chat = createChatStore();
