import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, of } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

const data: ConfirmDialogData = {
  title: 'Delete Thank PRs?',
  message: 'Its GitHub webhook will be removed.',
  confirmLabel: 'Delete',
};

describe('ConfirmDialogComponent', () => {
  let dialogRef: jasmine.SpyObj<MatDialogRef<ConfirmDialogComponent, boolean>>;

  function render(overrides: Partial<ConfirmDialogData> = {}) {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { ...data, ...overrides } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { el, buttons: Array.from(el.querySelectorAll('button')) };
  }

  it('renders title, message and labels', () => {
    const { el, buttons } = render();
    expect(el.textContent).toContain('Delete Thank PRs?');
    expect(el.textContent).toContain('Its GitHub webhook will be removed.');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Cancel', 'Delete']);
  });

  it('uses a custom cancel label', () => {
    const { buttons } = render({ cancelLabel: 'Keep editing', confirmLabel: 'Discard' });
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Keep editing', 'Discard']);
  });

  it('closes with true on confirm and false on cancel', () => {
    const { buttons } = render();
    buttons[1].click();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
    buttons[0].click();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  describe('open()', () => {
    function openWith(result: boolean | undefined) {
      const dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
      dialog.open.and.returnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown>);
      return { dialog, result$: ConfirmDialogComponent.open(dialog, data) };
    }

    it('passes the data to the dialog', () => {
      const { dialog } = openWith(true);
      expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, { data });
    });

    it('emits true only on confirm', async () => {
      expect(await firstValueFrom(openWith(true).result$)).toBeTrue();
      expect(await firstValueFrom(openWith(false).result$)).toBeFalse();
      expect(await firstValueFrom(openWith(undefined).result$)).toBeFalse();
    });
  });
});
