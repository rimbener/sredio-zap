import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BrowserLocationService } from '../core/browser-location.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let assign: jasmine.Spy<(url: string) => void>;

  function setup(queryParams: Record<string, string> = {}): HTMLElement {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: BrowserLocationService, useValue: { assign } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    assign = jasmine.createSpy('assign');
  });

  it('shows the brand, tagline and a "Sign in with GitHub" button in a card', () => {
    const el = setup();

    expect(el.querySelector('mat-card')).not.toBeNull();
    expect(el.querySelector('.brand')?.textContent?.trim()).toBe('⚡ Zaps');
    expect(el.querySelector('.tagline')?.textContent).toContain('when a PR opens, comment on it');
    expect(el.querySelector('button.sign-in')?.textContent?.trim()).toBe('Sign in with GitHub');
  });

  it('the button navigates the whole page to the server OAuth start', () => {
    const el = setup();

    el.querySelector<HTMLButtonElement>('button.sign-in')!.click();

    expect(assign).toHaveBeenCalledOnceWith('http://localhost:3000/auth/github');
  });

  it('shows no error message without the query param', () => {
    expect(setup().querySelector('.login-error')).toBeNull();
  });

  it('shows "Sign-in failed. Please try again." with ?error=oauth', () => {
    const el = setup({ error: 'oauth' });
    expect(el.querySelector('.login-error')?.textContent).toContain('Sign-in failed. Please try again.');
  });

  it('shows "Your GitHub session expired, please sign in again" with ?error=github_auth', () => {
    const el = setup({ error: 'github_auth' });
    expect(el.querySelector('.login-error')?.textContent).toContain(
      'Your GitHub session expired, please sign in again',
    );
  });

  it('shows no error message for an unknown ?error= value', () => {
    expect(setup({ error: 'constructor' }).querySelector('.login-error')).toBeNull();
  });
});
