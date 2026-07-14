export type ToastType = 'info' | 'error' | 'success';

export interface Toast {
	id: number;
	type: ToastType;
	message: string;
}

const DEFAULT_TIMEOUT = 4000;

function createToastStore() {
	let toasts = $state<Toast[]>([]);
	let nextId = 0;

	function push(message: string, type: ToastType = 'info', timeout = DEFAULT_TIMEOUT) {
		const id = nextId++;
		toasts = [...toasts, { id, type, message }];
		if (timeout > 0) {
			setTimeout(() => dismiss(id), timeout);
		}
		return id;
	}

	function dismiss(id: number) {
		toasts = toasts.filter((t) => t.id !== id);
	}

	return {
		get items() {
			return toasts;
		},
		push,
		dismiss,
		info: (m: string) => push(m, 'info'),
		error: (m: string) => push(m, 'error'),
		success: (m: string) => push(m, 'success')
	};
}

export const toast = createToastStore();
