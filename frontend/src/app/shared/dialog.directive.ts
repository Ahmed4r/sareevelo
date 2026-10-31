import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output } from '@angular/core';

/** Native dialogs provide modal focus containment and return focus to the opener. */
@Directive({ selector: 'dialog[appDialog]', standalone: true })
export class DialogDirective implements AfterViewInit, OnChanges {
  @Input() appDialog = false;
  @Output() dismissed = new EventEmitter<void>();
  private ready = false;

  constructor(private readonly element: ElementRef<HTMLDialogElement>) {}
  ngAfterViewInit(): void { this.ready = true; this.sync(); }
  ngOnChanges(): void { this.sync(); }
  private sync(): void {
    if (!this.ready) return;
    const dialog = this.element.nativeElement;
    if (this.appDialog && !dialog.open) dialog.showModal();
    if (!this.appDialog && dialog.open) dialog.close();
  }
  @HostListener('cancel', ['$event'])
  cancel(event: Event): void { event.preventDefault(); this.dismissed.emit(); }
  @HostListener('click', ['$event'])
  backdrop(event: MouseEvent): void {
    const dialog = this.element.nativeElement;
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      this.dismissed.emit();
    }
  }
}
