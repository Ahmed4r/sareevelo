import { Component, Input } from '@angular/core';

const paths = {
  dispatch: 'M8 5h8a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h8 M3 5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0 M16 16l3 3-3 3',
  orders: 'M4 7l8-4 8 4v10l-8 4-8-4z M4 7l8 4 8-4 M12 11v10 M8 5l8 4',
  drivers: 'M2 16V6h12v10 M14 9h4l4 5v3h-2 M2 17h2 M8 17h8 M14 13h7 M4 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0 M16 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  plus: 'M12 5v14 M5 12h14',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  refresh: 'M20 7a9 9 0 0 0-15-2L3 8 M3 3v5h5 M4 17a9 9 0 0 0 15 2l2-3 M21 21v-5h-5',
  close: 'M6 6l12 12 M6 18L18 6',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  check: 'M5 12l4 4L19 6',
  pin: 'M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 21v-3a8 6 0 0 1 16 0v3',
  alert: 'M12 3L2 21h20z M12 9v5 M12 17v1',
  sort: 'M8 4v16 M4 8l4-4 4 4 M16 20V4 M12 16l4 4 4-4',
  start: 'M4 5h8v14H4z M8 9l4 3-4 3 M16 8l4 4-4 4 M13 12h7',
  delivered: 'M3 6l7-3 7 3-7 4z M3 6v11l7 4 4-2 M10 10v11 M17 6v5 M15 15l3 3 4-5',
  history: 'M3 10a9 9 0 1 1 1 7 M3 4v6h6 M12 7v5l3 2',
  capacity: 'M3 4h18v16H3z M3 9h18 M9 9v11 M15 9v11'
};

// A shared two-tone treatment ties the operational symbols to the illustration palette.
const accents: Partial<Record<keyof typeof paths, string>> = {
  dispatch: 'M3 5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0',
  orders: 'M4 7l8 4v10l-8-4z M8 5l8 4 4-2-8-4z',
  drivers: 'M2 6h12v10H2z M14 9h4l3 4h-7z',
  person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 21v-3a8 6 0 0 1 16 0v3z',
  pin: 'M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z',
  start: 'M4 5h8v14H4z',
  delivered: 'M3 6l7 4v11l-7-4z',
  capacity: 'M3 9h6v11H3z M9 9h6v11H9z'
};

@Component({
  selector: 'app-icon', standalone: true,
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">@if(accents[name]; as accent){<path [attr.d]="accent" fill="currentColor" fill-opacity=".14" stroke="none"/>}<path [attr.d]="paths[name]"/></svg>',
  styles: ':host{display:inline-flex;width:18px;height:18px;flex:none;vertical-align:middle}svg{width:100%;height:100%;overflow:visible}'
})
export class IconComponent {
  @Input() name: keyof typeof paths = 'orders';
  readonly paths = paths;
  readonly accents = accents;
}
