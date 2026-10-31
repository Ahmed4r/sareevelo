import { Component, Input, OnChanges, ViewEncapsulation } from '@angular/core';
import { renderMarkdown } from './markdown';
@Component({
 selector: 'app-markdown', standalone: true,
 template: '<div class="markdown-body" [innerHTML]="html"></div>',
 styleUrl: './markdown.component.css', encapsulation: ViewEncapsulation.None
})
export class MarkdownComponent implements OnChanges {
 @Input() text = ''; html = '';
 ngOnChanges(): void { this.html = renderMarkdown(this.text); }
}
