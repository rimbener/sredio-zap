import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import type { ZapDto } from '@zaps/shared';
import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AppsService } from '../../core/apps.service';
import { GITHUB_APP, makeZap } from '../testing/zap-fixtures';
import { ZapToggleService } from '../zap-toggle.service';
import { ZapsService } from '../zaps.service';
import { ZapListComponent } from './zap-list.component';

/**
 * E9: a list action on a Zap that no longer exists. The interceptor shows
 * "This Zap no longer exists"; the list then reloads (Screens.md → Error handling).
 */
describe('ZapListComponent (NOT_FOUND on list actions)', () => {
  const gone = makeZap({ id: '1'.repeat(24), name: 'Gone' });
  const kept = makeZap({ id: '2'.repeat(24), name: 'Kept' });

  let list: jasmine.Spy<() => Observable<ZapDto[]>>;
  let setEnabled: jasmine.Spy;
  let deleteZap: jasmine.Spy;

  beforeEach(() => {
    list = jasmine.createSpy('list');
    list.and.returnValues(of([gone, kept]), of([kept]));
    setEnabled = jasmine.createSpy('setEnabled');
    deleteZap = jasmine.createSpy('delete');
    TestBed.configureTestingModule({
      imports: [ZapListComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ZapsService, useValue: { list, delete: deleteZap } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB_APP]) } },
        { provide: ZapToggleService, useValue: { setEnabled } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(ZapListComponent);
    fixture.detectChanges();
    const names = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-zap-card .name')).map((n) =>
        n.textContent?.trim(),
      );
    return { fixture, component: fixture.componentInstance, names };
  }

  const notFound = () => throwError(() => new ApiError(404, 'NOT_FOUND', 'Zap not found'));

  it('toggle → 404 reloads the list', () => {
    setEnabled.and.returnValue(notFound());
    const { fixture, component, names } = render();
    expect(names()).toEqual(['Gone', 'Kept']);

    component.onToggle({ zap: gone, enabled: true });
    fixture.detectChanges();

    expect(list).toHaveBeenCalledTimes(2);
    expect(names()).toEqual(['Kept']);
    expect(component.isToggling(gone)).toBeFalse();
  });

  it('delete → 404 reloads the list', () => {
    deleteZap.and.returnValue(notFound());
    const { fixture, component, names } = render();

    component.onDelete(gone);
    fixture.detectChanges();

    expect(deleteZap).toHaveBeenCalledOnceWith(gone.id);
    expect(list).toHaveBeenCalledTimes(2);
    expect(names()).toEqual(['Kept']);
  });

  it('other toggle and delete errors do not reload', () => {
    setEnabled.and.returnValue(throwError(() => new ApiError(502, 'GITHUB_ERROR', 'boom')));
    deleteZap.and.returnValue(throwError(() => new ApiError(502, 'GITHUB_ERROR', 'boom')));
    const { component } = render();

    component.onToggle({ zap: gone, enabled: true });
    component.onDelete(gone);

    expect(list).toHaveBeenCalledTimes(1);
  });
});
