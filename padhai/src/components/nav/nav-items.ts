export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/board', label: 'Board' },
  { href: '/review', label: 'Review' },
  { href: '/settings', label: 'Settings' },
] as const;
