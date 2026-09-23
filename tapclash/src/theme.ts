export const INK = '#22192B';
export const PAPER = '#FFF1DC';
export const PAPER_DEEP = '#F5DDB8';
export const BG = PAPER;
export const PINK = '#FF7EB6';
export const DANGER = '#FF3B5C';
export const WIN_GOLD = '#FFC933';

/** One mascot per seat. Colours double as their shape: round, square, triangle, gumdrop. */
export const PLAYER_COLORS = ['#FF5A3C', '#2F7BFF', '#FFC933', '#2DBE7E'];
export const PLAYER_DARK = ['#C8341C', '#1D56C4', '#D99A0B', '#1E8F5C'];
export const PLAYER_NAMES = ['BONK', 'BLIP', 'ZEST', 'MOSS'];
export const CRITTERS = ['bonk', 'blip', 'zest', 'moss'];

/** `rgba(INK, a)` shorthand for faint ink lines and secondary text. */
export const inkA = (a: number): string => `rgba(34,25,43,${a})`;
