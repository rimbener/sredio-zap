import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthState, AuthService } from '../core/auth.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let user$: BehaviorSubject<AuthState>;

  beforeEach(() => {
    user$ = new BehaviorSubject<AuthState>(undefined);
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([]), provideNoopAnimations(), { provide: AuthService, useValue: { user$ } }],
    });
  });

  it('shows the "⚡ Zaps" link to /zaps and a router outlet', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const brand = el.querySelector('mat-toolbar a.brand');
    expect(brand?.textContent?.trim()).toBe('⚡ Zaps');
    expect(brand?.getAttribute('href')).toBe('/zaps');
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('.avatar')).toBeNull();
  });

  it('shows the avatar once the user is known', () => {
    user$.next({ id: 'u1', login: 'octocat', name: null, avatarUrl: 'https://example.com/a.png' });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();

    const avatar = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.avatar');
    expect(avatar?.src).toBe('https://example.com/a.png');
  });

  it('opens the avatar menu with the login and Sign out', () => {
    user$.next({ id: 'u1', login: 'octocat', name: null, avatarUrl: 'https://example.com/a.png' });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.avatar-button')!.click();
    fixture.detectChanges();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const items = Array.from(overlay.querySelectorAll('[mat-menu-item]')).map((item) => item.textContent?.trim());
    expect(items).toEqual(['octocat', 'Sign out']);
  });
});
