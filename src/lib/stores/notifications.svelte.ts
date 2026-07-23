import { browser } from '$app/environment';

const STORAGE_KEY = 'windaster_notifications';
// Set once we've auto-prompted, so a still-"default" state (dismissed prompt)
// isn't re-asked on every reload.
const PROMPTED_KEY = 'windaster_notifications_prompted';

type Permission = 'default' | 'granted' | 'denied';

export interface NotifyOptions {
	title: string;
	body: string;
	/** Collapses repeat notifications for the same chat/message into one. */
	tag?: string;
	/** Chat to open when the notification is clicked. */
	chatId?: number;
}

function readEnabled(): boolean {
	if (!browser) return true;
	// Default on; only an explicit "0" disables (so first-time users get alerts
	// once they grant permission).
	return localStorage.getItem(STORAGE_KEY) !== '0';
}

function createNotifications() {
	const supported = browser && typeof Notification !== 'undefined';

	let permission = $state<Permission>(
		supported ? (Notification.permission as Permission) : 'denied'
	);
	let enabled = $state<boolean>(readEnabled());

	// A single AudioContext, created lazily on the first user gesture (the bell
	// click) so the browser autoplay policy lets us make sound later.
	let audioCtx: AudioContext | null = null;
	// Whether the one-time gesture listeners that unlock audio are installed.
	let audioArmed = false;

	// Callback wired up by the chat store so a clicked notification can open the
	// right conversation without this module importing the store (avoids a cycle).
	let openChat: ((chatId: number) => void) | null = null;

	function unlockAudio() {
		if (!browser) return;
		try {
			const Ctx =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Ctx) return;
			if (!audioCtx) audioCtx = new Ctx();
			if (audioCtx.state === 'suspended') void audioCtx.resume();
		} catch {
			// Audio is a nice-to-have; ignore failures.
		}
	}

	function playSound() {
		if (!audioCtx) return;
		try {
			const now = audioCtx.currentTime;
			const gain = audioCtx.createGain();
			gain.connect(audioCtx.destination);
			// Short two-tone ping with a quick decay envelope.
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

			const tones = [
				{ freq: 880, start: 0, stop: 0.15 },
				{ freq: 1180, start: 0.12, stop: 0.3 }
			];
			for (const t of tones) {
				const osc = audioCtx.createOscillator();
				osc.type = 'sine';
				osc.frequency.value = t.freq;
				osc.connect(gain);
				osc.start(now + t.start);
				osc.stop(now + t.stop);
			}
		} catch {
			// ignore
		}
	}

	const active = $derived(supported && permission === 'granted' && enabled);

	// Alert only when the window isn't actively being viewed — a focused window is
	// already covered by the live thread and unread pills.
	function shouldAlert(): boolean {
		if (!active || !browser) return false;
		return document.visibilityState !== 'visible' || !document.hasFocus();
	}

	function notify(opts: NotifyOptions) {
		if (!shouldAlert()) return;
		try {
			const n = new Notification(opts.title, {
				body: opts.body,
				tag: opts.tag,
				icon: '/favicon.svg'
			});
			n.onclick = () => {
				window.focus();
				if (opts.chatId != null) openChat?.(opts.chatId);
				n.close();
			};
		} catch {
			// Some environments throw when constructing Notification directly.
		}
		playSound();
	}

	return {
		get supported() {
			return supported;
		},
		get permission() {
			return permission;
		},
		get enabled() {
			return enabled;
		},
		get active() {
			return active;
		},
		/**
		 * Ask for permission automatically on first /app load. Only prompts while
		 * the state is still `default`, and at most once per browser (guarded by a
		 * localStorage flag) so a dismissed prompt isn't re-asked every reload.
		 */
		async autoRequest() {
			if (!supported || permission !== 'default') return;
			if (browser) {
				if (localStorage.getItem(PROMPTED_KEY)) return;
				localStorage.setItem(PROMPTED_KEY, '1');
			}
			await this.requestPermission();
		},
		/**
		 * Install one-time gesture listeners that resume the (auto-created,
		 * suspended) AudioContext, so the ping works after an auto-granted
		 * permission where there was no click to unlock audio.
		 */
		armAudioUnlock() {
			if (!browser || audioArmed) return;
			audioArmed = true;
			const opts = { once: true } as const;
			window.addEventListener('pointerdown', unlockAudio, opts);
			window.addEventListener('keydown', unlockAudio, opts);
		},
		/** Called from the bell (a user gesture): request permission + unlock audio. */
		async requestPermission() {
			if (!supported) return;
			unlockAudio();
			try {
				permission = (await Notification.requestPermission()) as Permission;
			} catch {
				permission = Notification.permission as Permission;
			}
			if (permission === 'granted') {
				enabled = true;
				if (browser) localStorage.removeItem(STORAGE_KEY);
			}
		},
		/** Toggle alerts on/off once permission is already granted. */
		toggleEnabled() {
			enabled = !enabled;
			if (browser) {
				if (enabled) localStorage.removeItem(STORAGE_KEY);
				else localStorage.setItem(STORAGE_KEY, '0');
			}
			if (enabled) unlockAudio();
		},
		/** Register how a clicked notification should open a chat. */
		setOpenChat(fn: (chatId: number) => void) {
			openChat = fn;
		},
		notify,
		setDocumentTitle(unread: number) {
			if (!browser) return;
			document.title = unread > 0 ? `(${unread > 99 ? '99+' : unread}) WindAster` : 'WindAster';
		}
	};
}

export const notifications = createNotifications();
