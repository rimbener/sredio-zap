import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { ZapDto } from '@zaps/shared';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AppsService } from '../../core/apps.service';
import { GITHUB_APP, makeZap } from '../testing/zap-fixtures';
import { ZapsService } from '../zaps.service';
import { ZapListComponent } from './zap-list.component';

describe('ZapListComponent', () => {
  let list: jasmine.Spy<() => Observable<ZapDto[]>>;
  let fixture: ComponentFixture<ZapListComponent>;

  function render(): HTMLElement {
    fixture = TestBed.createComponent(ZapListComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    list = jasmine.createSpy('list');
    TestBed.configureTestingModule({
      imports: [ZapListComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ZapsService, useValue: { list } },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB_APP]) } },
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
});
