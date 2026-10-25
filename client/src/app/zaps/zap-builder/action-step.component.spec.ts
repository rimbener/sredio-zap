import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { GITHUB_APP as GITHUB } from '../testing/zap-fixtures';
import { ActionStepComponent } from './action-step.component';
import { createZapForm } from './zap-form';

describe('ActionStepComponent', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [ActionStepComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(ActionStepComponent);
    const form = createZapForm(GITHUB);
    const group = form.controls.action;
    fixture.componentInstance.app = GITHUB;
    fixture.componentInstance.expanded = true;
    fixture.componentRef.setInput('group', group);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const textarea = el.querySelector('textarea')!;
    return { fixture, component: fixture.componentInstance, form, group, el, textarea };
  }

  function type(textarea: HTMLTextAreaElement, value: string) {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
  }

  it('lists the trigger tokens with labels in the Insert field menu', () => {
    const { fixture, el } = render();
    (el.querySelector('button.insert-field') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).map((i) => i.textContent?.trim());
    expect(items).toContain('PR author {{pr.author}}');
    expect(items.length).toBe(7);
  });

  it('inserts a token at the cursor in the middle of the text', () => {
    const { fixture, component, group, textarea } = render();
    type(textarea, 'Hello world');
    textarea.setSelectionRange(6, 6);
    component.insertToken('pr.author');
    fixture.detectChanges();
    expect(group.controls.body.value).toBe('Hello {{pr.author}}world');
    expect(textarea.value).toBe('Hello {{pr.author}}world');
    expect(textarea.selectionStart).toBe(6 + '{{pr.author}}'.length);
    expect(group.controls.body.dirty).toBeTrue();
  });

  it('replaces the selected text when inserting', () => {
    const { component, group, textarea } = render();
    type(textarea, 'Hi NAME!');
    textarea.setSelectionRange(3, 7);
    component.insertToken('pr.author');
    expect(group.controls.body.value).toBe('Hi {{pr.author}}!');
  });

  it('inserts from the menu', () => {
    const { fixture, group, el, textarea } = render();
    type(textarea, 'Title: ');
    textarea.setSelectionRange(7, 7);
    (el.querySelector('button.insert-field') as HTMLButtonElement).click();
    fixture.detectChanges();
    const item = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-menu-item')).find((i) =>
      i.textContent?.includes('{{pr.title}}'),
    )!;
    item.click();
    fixture.detectChanges();
    expect(group.controls.body.value).toBe('Title: {{pr.title}}');
    expect(el.querySelector('.preview-body')?.textContent).toBe('Title: Fix login redirect');
  });

  it('renders the default comment in the preview with sample data', () => {
    const { el } = render();
    expect(el.querySelector('.preview-body')?.textContent).toBe('Thanks @octocat for opening this pull request!');
  });

  it('updates the preview on input', () => {
    const { fixture, el, textarea } = render();
    type(textarea, 'PR #{{pr.number}}: {{pr.title}}');
    fixture.detectChanges();
    expect(el.querySelector('.preview-body')?.textContent).toBe('PR #42: Fix login redirect');
  });

  it('counts JS length, so an emoji counts as 2', () => {
    const { fixture, el, textarea } = render();
    type(textarea, 'ok 🎉');
    fixture.detectChanges();
    expect(el.querySelector('.counter')?.textContent?.trim()).toBe('5 / 65536');
  });

  it('shows "Unknown field {{x}}" and makes the form invalid', () => {
    const { fixture, form, group, el, textarea } = render();
    type(textarea, 'Hi {{nope}}');
    fixture.detectChanges();
    expect(group.controls.body.invalid).toBeTrue();
    expect(form.invalid).toBeTrue();
    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe('Unknown field {{nope}}');

    type(textarea, 'Hi {{pr.author}}');
    fixture.detectChanges();
    expect(group.controls.body.valid).toBeTrue();
    expect(el.querySelector('mat-error')).toBeNull();
  });
});
