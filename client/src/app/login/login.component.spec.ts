import { TestBed } from '@angular/core/testing';
import { BrowserLocationService } from '../core/browser-location.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let assign: jasmine.Spy<(url: string) => void>;

  beforeEach(() => {
    assign = jasmine.createSpy('assign');
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: BrowserLocationService, useValue: { assign } }],
    });
  });

  it('shows the brand, tagline and a "Sign in with GitHub" button in a card', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('mat-card')).not.toBeNull();
    expect(el.querySelector('.brand')?.textContent?.trim()).toBe('⚡ Zaps');
    expect(el.querySelector('.tagline')?.textContent).toContain('when a PR opens, comment on it');
    expect(el.querySelector('button.sign-in')?.textContent?.trim()).toBe('Sign in with GitHub');
  });

  it('the button navigates the whole page to the server OAuth start', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.sign-in')!.click();

    expect(assign).toHaveBeenCalledOnceWith('http://localhost:3000/auth/github');
  });
});
