import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { ZapDto } from '@zaps/shared';
import { ZapCardComponent, ZapToggleEvent } from './zap-card.component';
import { GITHUB_APP, makeZap } from '../testing/zap-fixtures';

describe('ZapCardComponent', () => {
  let fixture: ComponentFixture<ZapCardComponent>;

  function render(zap: ZapDto, apps = [GITHUB_APP]): HTMLElement {
    TestBed.configureTestingModule({ imports: [ZapCardComponent], providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(ZapCardComponent);
    fixture.componentInstance.zap = zap;
    fixture.componentInstance.apps = apps;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the app icon and name, the summary from the catalog and the updated date', () => {
    const el = render(makeZap());
    const icon = el.querySelector<HTMLImageElement>('.app-icon');
    expect(icon?.getAttribute('src')).toBe('assets/apps/github.svg');
    expect(el.querySelector('.app-name')?.textContent?.trim()).toBe('GitHub');
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Thank PRs');
    expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
      'Pull request opened in acme/api → Comment on the pull request',
    );
    expect(el.querySelector('.updated')?.textContent?.trim()).toBe('Updated Oct 25, 2026');
  });

  it('falls back to the event keys when the catalog lacks them', () => {
    const el = render(makeZap(), []);
    expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
      'pull_request.opened in acme/api → pull_request.comment',
    );
    expect(el.querySelector('.app-icon')).toBeNull();
  });

  it('shows the toggle in the Zap state', () => {
    const on = render(makeZap({ enabled: true }));
    expect(on.querySelector('.toggle button')?.getAttribute('aria-checked')).toBe('true');
    expect(on.querySelector('.toggle')?.textContent).toContain('On');
  });

  it('emits toggle with the requested state', () => {
    const zap = makeZap();
    const el = render(zap);
    const events: ZapToggleEvent[] = [];
    fixture.componentInstance.toggle.subscribe((e) => events.push(e));

    el.querySelector<HTMLButtonElement>('.toggle button')!.click();
    expect(events).toEqual([{ zap, enabled: true }]);
  });

  it('disables the toggle while toggling and snaps back to zap.enabled when it ends', () => {
    const el = render(makeZap({ enabled: false }));
    const button = () => el.querySelector<HTMLButtonElement>('.toggle button')!;

    button().click();
    fixture.componentRef.setInput('toggling', true);
    fixture.detectChanges();
    expect(button().disabled).toBeTrue();
    expect(button().getAttribute('aria-checked')).toBe('true');

    fixture.componentRef.setInput('toggling', false);
    fixture.detectChanges();
    expect(button().disabled).toBeFalse();
    expect(button().getAttribute('aria-checked')).toBe('false');
  });

  it('emits edit when the card is clicked, but not from the toggle or the ⋮ button', () => {
    const zap = makeZap();
    const el = render(zap);
    const edits: ZapDto[] = [];
    fixture.componentInstance.edit.subscribe((z) => edits.push(z));

    el.querySelector<HTMLButtonElement>('.toggle button')!.click();
    el.querySelector<HTMLButtonElement>('.menu-button')!.click();
    expect(edits).toEqual([]);

    el.querySelector<HTMLElement>('.summary')!.click();
    expect(edits).toEqual([zap]);
  });

  it('emits edit and delete from the ⋮ menu', () => {
    const zap = makeZap();
    const el = render(zap);
    const edits: ZapDto[] = [];
    const deletes: ZapDto[] = [];
    fixture.componentInstance.edit.subscribe((z) => edits.push(z));
    fixture.componentInstance.delete.subscribe((z) => deletes.push(z));

    el.querySelector<HTMLButtonElement>('.menu-button')!.click();
    fixture.detectChanges();
    document.querySelector<HTMLButtonElement>('.edit-item')!.click();
    el.querySelector<HTMLButtonElement>('.menu-button')!.click();
    fixture.detectChanges();
    document.querySelector<HTMLButtonElement>('.delete-item')!.click();

    expect(edits).toEqual([zap]);
    expect(deletes).toEqual([zap]);
  });
});
