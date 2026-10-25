import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { ZapDto } from '@zaps/shared';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AppsService } from '../../core/apps.service';
import { AppPickerDialogComponent } from '../app-picker/app-picker-dialog.component';
import { GITHUB_APP, makeZap } from '../testing/zap-fixtures';
import { ApiError } from '../../core/api-error';
import { ZapToggleService } from '../zap-toggle.service';
import { ZapsService } from '../zaps.service';
import { ZapListComponent } from './zap-list.component';

describe('ZapListComponent', () => {
  let list: jasmine.Spy<() => Observable<ZapDto[]>>;
  let setEnabled: jasmine.Spy<(zap: ZapDto, enabled: boolean) => Observable<ZapDto>>;
  let fixture: ComponentFixture<ZapListComponent>;

  function render(): HTMLElement {
    fixture = TestBed.createComponent(ZapListComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    list = jasmine.createSpy('list');
    setEnabled = jasmine.createSpy('setEnabled');
    TestBed.configureTestingModule({
      imports: [ZapListComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ZapsService, useValue: { list } },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB_APP]) } },
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open']) },
        { provide: ZapToggleService, useValue: { setEnabled } },
      ],
    });
  });

  it('shows a spinner while loading', () => {
    list.and.returnValue(new Subject<ZapDto[]>());
    const el = render();
    expect(el.querySelector('.loading mat-spinner')).not.toBeNull();
    expect(el.querySelector('app-zap-card')).toBeNull();
  });

  it('renders one card per Zap, in server order', () => {
    list.and.returnValue(
      of([makeZap({ id: '1'.repeat(24), name: 'Newer' }), makeZap({ id: '2'.repeat(24), name: 'Older' })]),
    );
    const el = render();
    const names = Array.from(el.querySelectorAll('app-zap-card .name')).map((n) => n.textContent?.trim());
    expect(names).toEqual(['Newer', 'Older']);
    expect(el.querySelector('.empty')).toBeNull();
    expect(el.querySelector('.header .create-button')).not.toBeNull();
  });

  it('shows the empty state with Create Zap when there are no Zaps', () => {
    list.and.returnValue(of([]));
    const el = render();
    expect(el.querySelector('.empty')?.textContent).toContain(
      'No Zaps yet. Create your first one: when a PR opens, comment on it.',
    );
    expect(el.querySelector('.empty .create-button')).not.toBeNull();
    expect(el.querySelector('app-zap-card')).toBeNull();
  });

  it('shows the error state and Retry re-requests the Zaps', () => {
    list.and.returnValue(throwError(() => new Error('boom')));
    const el = render();
    expect(el.querySelector('.error')).not.toBeNull();
    expect(list).toHaveBeenCalledTimes(1);

    list.and.returnValue(of([makeZap()]));
    el.querySelector<HTMLButtonElement>('.retry-button')!.click();
    fixture.detectChanges();

    expect(list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.error')).toBeNull();
    expect(el.querySelectorAll('app-zap-card').length).toBe(1);
  });

  it('routes card events and Create Zap to the (empty) handlers', () => {
    const zap = makeZap();
    list.and.returnValue(of([zap]));
    const el = render();
    const component = fixture.componentInstance;
    spyOn(component, 'onCreate');
    spyOn(component, 'onToggle');

    el.querySelector<HTMLButtonElement>('.header .create-button')!.click();
    el.querySelector<HTMLButtonElement>('app-zap-card .toggle button')!.click();

    expect(component.onCreate).toHaveBeenCalled();
    expect(component.onToggle).toHaveBeenCalledWith({ zap, enabled: true });
  });

  it('Create Zap opens the app picker from the header and the empty state', () => {
    list.and.returnValue(of([]));
    const el = render();
    const dialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;

    el.querySelector<HTMLButtonElement>('.header .create-button')!.click();
    el.querySelector<HTMLButtonElement>('.empty .create-button')!.click();

    expect(dialog.open).toHaveBeenCalledTimes(2);
    expect(dialog.open.calls.allArgs().every(([component]) => component === AppPickerDialogComponent)).toBeTrue();
  });

  describe('toggle', () => {
    function toggleButton(el: HTMLElement): HTMLButtonElement {
      return el.querySelector<HTMLButtonElement>('app-zap-card .toggle button')!;
    }

    it('is disabled while the request runs and uses the returned enabled on success', () => {
      const zap = makeZap({ enabled: false });
      list.and.returnValue(of([zap]));
      const response = new Subject<ZapDto>();
      setEnabled.and.returnValue(response);
      const el = render();

      toggleButton(el).click();
      fixture.detectChanges();

      expect(setEnabled).toHaveBeenCalledOnceWith(zap, true);
      expect(toggleButton(el).disabled).toBeTrue();

      response.next({ ...zap, enabled: true, updatedAt: '2026-10-26T10:00:00.000Z' });
      response.complete();
      fixture.detectChanges();

      expect(toggleButton(el).disabled).toBeFalse();
      expect(toggleButton(el).getAttribute('aria-checked')).toBe('true');
      expect(fixture.componentInstance.zaps[0].enabled).toBeTrue();
      expect(el.querySelector('app-zap-card .toggle')?.textContent).toContain('On');
    });

    it('turns an enabled Zap off', () => {
      const zap = makeZap({ enabled: true });
      list.and.returnValue(of([zap]));
      setEnabled.and.returnValue(of({ ...zap, enabled: false }));
      const el = render();

      toggleButton(el).click();
      fixture.detectChanges();

      expect(setEnabled).toHaveBeenCalledOnceWith(zap, false);
      expect(toggleButton(el).getAttribute('aria-checked')).toBe('false');
    });

    it('reverts on error and re-enables the toggle', () => {
      const zap = makeZap({ enabled: false });
      list.and.returnValue(of([zap]));
      const response = new Subject<ZapDto>();
      setEnabled.and.returnValue(response);
      const el = render();

      toggleButton(el).click();
      fixture.detectChanges();
      expect(toggleButton(el).getAttribute('aria-checked')).toBe('true');

      response.error(new ApiError(502, 'GITHUB_ERROR', 'boom'));
      fixture.detectChanges();

      expect(toggleButton(el).disabled).toBeFalse();
      expect(toggleButton(el).getAttribute('aria-checked')).toBe('false');
      expect(fixture.componentInstance.zaps[0].enabled).toBeFalse();
    });
  });
});
