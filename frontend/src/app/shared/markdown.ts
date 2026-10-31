import { Marked } from 'marked';
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const parser = new Marked({ gfm: true, breaks: true, renderer: {
  html: ({ text }) => escape(text),
  image: ({ text }) => escape(text),
  link({ href, tokens }) {
    const label = this.parser.parseInline(tokens);
    // Only explicit web/mail links; no executable, relative or protocol-relative URLs.
    if (!/^(https?:\/\/|mailto:)/i.test(href) || /[\u0000-\u0020]/.test(href)) return label;
    return `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }
} });
export function renderMarkdown(text: string): string { return parser.parse(text, { async: false }); }
