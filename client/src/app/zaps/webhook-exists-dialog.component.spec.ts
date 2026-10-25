import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../core/api-error';
import {
  WEBHOOK_EXISTS_TOGGLE_MESSAGE,
  WebhookExistsDialogComponent,
  WebhookExistsDialogData,
  hookSettingsUrlOf,
} from './webhook-exists-dialog.component';

const HOOK_URL = 'https://github.com/acme/api/settings/hooks/987';

describe('WebhookExistsDialogComponent', () => {
  let dialogRef: jasmine.SpyObj<MatDialogRef<WebhookExistsDialogComponent>>;

  function render(data: WebhookExistsDialogData) {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [WebhookExistsDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(WebhookExistsDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the message, a link to the hook in a new tab, and Close', () => {
    const el = render({ message: WEBHOOK_EXISTS_TOGGLE_MESSAGE, hookSettingsUrl: HOOK_URL });
    expect(el.textContent).toContain(WEBHOOK_EXISTS_TOGGLE_MESSAGE);

    const link = el.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Open webhook on GitHub');
    expect(link.getAttribute('href')).toBe(HOOK_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');

    const close = el.querySelector('button') as HTMLButtonElement;
    expect(close.textContent?.trim()).toBe('Close');
    close.click();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('shows the message passed in (reusable for other call sites)', () => {
    const el = render({ message: 'Another text', hookSettingsUrl: HOOK_URL });
    expect(el.textContent).toContain('Another text');
  });

  it('hides the link without a usable URL', () => {
    const el = render({ message: WEBHOOK_EXISTS_TOGGLE_MESSAGE, hookSettingsUrl: null });
    expect(el.querySelector('a')).toBeNull();
  });

  it('open() passes the message and details.hookSettingsUrl', () => {
    const dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    const error = new ApiError(409, 'WEBHOOK_EXISTS', 'exists', { hookSettingsUrl: HOOK_URL });
    WebhookExistsDialogComponent.open(dialog, error, 'Text');
    expect(dialog.open).toHaveBeenCalledWith(WebhookExistsDialogComponent, {
      data: { message: 'Text', hookSettingsUrl: HOOK_URL },
    });
  });

  it('hookSettingsUrlOf only accepts https GitHub URLs', () => {
    const of = (details: unknown) => hookSettingsUrlOf(new ApiError(409, 'WEBHOOK_EXISTS', '', details));
    expect(of({ hookSettingsUrl: HOOK_URL })).toBe(HOOK_URL);
    expect(of({ hookSettingsUrl: 'javascript:alert(1)' })).toBeNull();
    expect(of({ hookSettingsUrl: 42 })).toBeNull();
    expect(of(undefined)).toBeNull();
  });
});
