import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'sareevelo-theme';
export function readTheme(storage?: Pick<Storage, 'getItem'>): Theme {
  try { return storage?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly current = signal<Theme>('light');
  constructor() {
    let theme: Theme = 'light';
    try { theme = readTheme(globalThis.localStorage); } catch { /* Storage can be disabled. */ }
    this.apply(theme);
  }
  toggle(): void {
    const theme = this.current() === 'light' ? 'dark' : 'light';
    this.apply(theme);
    try { globalThis.localStorage?.setItem(THEME_KEY, theme); } catch { /* The toggle still works without persistence. */ }
  }
  private apply(theme: Theme): void {
    this.current.set(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['theme'] = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f3ef' : '#080808');
    }
  }
}
