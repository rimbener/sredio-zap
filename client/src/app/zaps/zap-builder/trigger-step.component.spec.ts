import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { RepoDto } from '@zaps/shared';
import { GITHUB_APP as GITHUB } from '../testing/zap-fixtures';
import { TriggerStepComponent } from './trigger-step.component';
import { createZapForm } from './zap-form';

const REPOS: RepoDto[] = [
  { owner: 'acme', repo: 'api', fullName: 'acme/api', htmlUrl: 'https://github.com/acme/api' },
  { owner: 'Acme', repo: 'Web', fullName: 'Acme/Web', htmlUrl: 'https://github.com/Acme/Web' },
  { owner: 'me', repo: 'site', fullName: 'me/site', htmlUrl: 'https://github.com/me/site' },
];

describe('TriggerStepComponent', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [TriggerStepComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(TriggerStepComponent);
    const group = createZapForm(GITHUB).controls.trigger;
    fixture.componentInstance.app = GITHUB;
    fixture.componentInstance.group = group;
    fixture.componentInstance.repos = REPOS;
    fixture.componentInstance.expanded = true;
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, group, el: fixture.nativeElement as HTMLElement };
  }

  it('lists every repo before typing', () => {
    const { component } = render();
    expect(component.filteredRepos).toEqual(REPOS);
  });

  it('filters by fullName, case-insensitive substring', () => {
    const { component, group } = render();
    group.controls.repo.setValue('ACME');
    expect(component.filteredRepos.map((r) => r.fullName)).toEqual(['acme/api', 'Acme/Web']);
    group.controls.repo.setValue('nope');
    expect(component.filteredRepos).toEqual([]);
  });

  it('shows the no-results option when nothing matches', () => {
    const { fixture, group } = render();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    group.controls.repo.setValue('nope');
    input.dispatchEvent(new Event('focusin'));
    fixture.detectChanges();
    expect(document.body.textContent).toContain('No matching repos. You need admin rights on a public repo.');
  });

  it('shows the read-only app, the hint and a summary once a repo is picked', () => {
    const { fixture, component, group, el } = render();
    expect(el.textContent).toContain('GitHub');
    expect(el.textContent).toContain("Only public repos where you're an admin are listed.");
    expect(component.summary).toBeNull();

    group.controls.repo.setValue(REPOS[0]);
    fixture.detectChanges();
    expect(component.summary).toBe('Pull request opened in acme/api');
    expect(el.textContent).toContain('Pull request opened in acme/api');
  });

  describe('saved repo missing from the list', () => {
    const MISSING_HINT = "This repo isn't in your list anymore; you may have lost admin access.";
    const gone: RepoDto = { owner: 'old', repo: 'repo', fullName: 'old/repo', htmlUrl: 'https://github.com/old/repo' };

    it('shows the hint and keeps the saved repo valid', () => {
      const { fixture, group, el } = render();
      fixture.componentInstance.reposLoaded = true;
      group.controls.repo.setValue(gone);
      fixture.detectChanges();
      expect(group.valid).toBeTrue();
      expect(el.textContent).toContain(MISSING_HINT);
    });

    it('no hint for a listed repo (case-insensitive) or when the list failed to load', () => {
      const { fixture, group, el } = render();
      fixture.componentInstance.reposLoaded = true;
      group.controls.repo.setValue({ ...REPOS[1], owner: 'acme', repo: 'web' });
      fixture.detectChanges();
      expect(el.textContent).not.toContain(MISSING_HINT);

      fixture.componentInstance.reposLoaded = false;
      group.controls.repo.setValue(gone);
      fixture.detectChanges();
      expect(el.textContent).not.toContain(MISSING_HINT);
    });
  });
});
