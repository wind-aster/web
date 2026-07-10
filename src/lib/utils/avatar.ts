const PALETTE = [
	'#3eb489',
	'#4a90d9',
	'#9b59b6',
	'#e67e22',
	'#e74c3c',
	'#1abc9c',
	'#2980b9',
	'#8e44ad'
];

/** Deterministic avatar color from a name (stable across renders). */
export function getAvatarColor(name: string): string {
	let h = 0;
	for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
	return PALETTE[h % PALETTE.length];
}
