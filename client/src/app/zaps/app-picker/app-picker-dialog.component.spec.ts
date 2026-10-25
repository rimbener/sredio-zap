import { OverlayContainer } from '@angular/cdk/overlay';
import { ApplicationRef } from '@angular/core';
import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import type { AppDto } from '@zaps/shared';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AppsService } from '../../core/apps.service';
import { GITHUB_APP } from '../testing/zap-fixtures';
import { AppPickerDialogComponent } from './app-picker-dialog.component';

function comingSoon(key: string, name: string, order: number): AppDto {
  return {
    ...GITHUB_APP,
    id: String(order).repeat(24),
    key,
    name,
    icon: `assets/apps/${key}.svg`,
    status: 'coming_soon',
    order,
    triggers: [],
    actions: [],
  };
}

// Deliberately out of order: the dialog sorts by `order`.
const APPS: AppDto[] = [
  comingSoon('slack', 'Slack', 5),
  comingSoon('jira', 'Jira', 3),
  GITHUB_APP,
  comingSoon('linear', 'Linear', 4),
  comingSoon('gitlab', 'GitLab', 2),
];

describe('AppPickerDialogComponent', () => {
  let getApps: jasmine.Spy<() => Observable<AppDto[]>>;
  let dialogRef: MatDialogRef<AppPickerDialogComponent>;
  let overlay: HTMLElement;

  function open(): void {
    dialogRef = AppPickerDialogComponent.open(TestBed.inject(MatDialog));
    TestBed.inject(ApplicationRef).tick();
  }

  function tiles(): HTMLButtonElement[] {
    return Array.from(overlay.querySelectorAll<HTMLButtonElement>('.tile'));
  }

  function isOpen(): boolean {
    return overlay.querySelector('app-app-picker-dialog') !== null;
  }

  beforeEach(() => {
    getApps = jasmine.createSpy('getApps').and.returnValue(of(APPS));
    TestBed.configureTestingModule({
      imports: [MatDialogModule],
      providers: [provideNoopAnimations(), provideRouter([]), { provide: AppsService, useValue: { getApps } }],
    });
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('shows the 5 apps as tiles, sorted by order', () => {
    open();
    expect(overlay.textContent).toContain('Choose the app that starts your Zap');
    expect(tiles().map((t) => t.querySelector('.name')?.textContent?.trim())).toEqual([
      'GitHub',
      'GitLab',
      'Jira',
      'Linear',
      'Slack',
    ]);
  });

  it('marks coming-soon tiles with a badge and aria-disabled, but not GitHub', () => {
    open();
    const [github, ...others] = tiles();
    expect(github.getAttribute('aria-disabled')).toBeNull();
    expect(github.querySelector('.badge')).toBeNull();
    for (const tile of others) {
      expect(tile.getAttribute('aria-disabled')).toBe('true');
      expect(tile.classList).toContain('coming-soon');
      expect(tile.querySelector('.badge')?.textContent?.trim()).toBe('Coming soon');
    }
  });

  it('does nothing when a coming-soon tile is clicked', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    open();
    const close = spyOn(dialogRef, 'close');
    tiles()[1].click();
    expect(close).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('picking GitHub closes the dialog and opens the builder with its id', fakeAsync(() => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    open();
    tiles()[0].click();
    flush();
    expect(navigate).toHaveBeenCalledWith(['/zaps/new'], { queryParams: { appId: GITHUB_APP.id } });
    expect(isOpen()).toBeFalse();
  }));

  it('closes with Esc', fakeAsync(() => {
    open();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(event, 'keyCode', { get: () => 27 });
    document.body.dispatchEvent(event);
    flush();
    expect(isOpen()).toBeFalse();
  }));

  it('closes with the ✕ button', fakeAsync(() => {
    open();
    overlay.querySelector<HTMLButtonElement>('.close-button')!.click();
    flush();
    expect(isOpen()).toBeFalse();
  }));

  it('shows a spinner until the apps arrive', () => {
    const apps$ = new Subject<AppDto[]>();
    getApps.and.returnValue(apps$);
    open();
    expect(overlay.querySelector('.loading mat-spinner')).not.toBeNull();
    apps$.next(APPS);
    TestBed.inject(ApplicationRef).tick();
    expect(overlay.querySelector('.loading')).toBeNull();
    expect(tiles().length).toBe(5);
  });

  it('closes when the apps fail to load (the interceptor shows the snackbar)', fakeAsync(() => {
    getApps.and.returnValue(throwError(() => new Error('boom')));
    open();
    flush();
    expect(isOpen()).toBeFalse();
  }));
});
