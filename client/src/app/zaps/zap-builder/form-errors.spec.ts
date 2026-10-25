import { HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { RepoDto, ValidationIssue, ZapDto } from '@zaps/shared';
import { Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { HANDLED_ERROR_CODES } from '../../core/http-error.interceptor';
import { NotificationService } from '../../core/notification.service';
import { GITHUB_APP as GITHUB, makeZap } from '../testing/zap-fixtures';
import { ZapsService } from '../zaps.service';
import { applyValidationErrors, controlForPath, saveContext } from './form-errors';
import { ZapBuilderComponent } from './zap-builder.component';
import { ZapForm, createZapForm } from './zap-form';

const REPO: RepoDto = { owner: 'acme', repo: 'api', fullName: 'acme/api', htmlUrl: 'https://github.com/acme/api' };

function validationError(details?: ValidationIssue[], message = 'Invalid request'): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details);
}

describe('form-errors', () => {
  let form: ZapForm;

  beforeEach(() => {
    form = createZapForm(GITHUB);
    form.controls.trigger.controls.repo.setValue(REPO);
  });

  it('saveContext() opts the save out of the VALIDATION_ERROR snackbar', () => {
    expect(saveContext().get(HANDLED_ERROR_CODES)).toEqual(['VALIDATION_ERROR']);
  });

  it('maps request paths to the builder controls', () => {
    const { name, trigger, action } = form.controls;
    expect(controlForPath(form, ['name'])).toBe(name);
    expect(controlForPath(form, ['trigger', 'event'])).toBe(trigger.controls.event);
    expect(controlForPath(form, ['trigger', 'config', 'owner'])).toBe(trigger.controls.repo);
    expect(controlForPath(form, ['trigger', 'config', 'repo'])).toBe(trigger.controls.repo);
    expect(controlForPath(form, ['action', 'event'])).toBe(action.controls.event);
    expect(controlForPath(form, ['action', 'config', 'body'])).toBe(action.controls.body);
  });

  it('leaves paths without a field unmapped', () => {
    for (const path of [['appId'], ['trigger', 'app'], ['trigger'], [], ['names']]) {
      expect(controlForPath(form, path)).withContext(path.join('.')).toBeNull();
    }
  });

  it('a body issue sets a touched field error on the body control, and no snackbar text', () => {
    const body = form.controls.action.controls.body;
    const message = applyValidationErrors(
      form,
      validationError([{ path: ['action', 'config', 'body'], message: 'Unknown token {{pr.nope}}' }]),
    );

    expect(message).toBeNull();
    expect(body.getError('zod')).toBe('Unknown token {{pr.nope}}');
    expect(body.touched).toBeTrue();
    expect(form.valid).toBeFalse();
  });

  it('keeps the first message per field', () => {
    applyValidationErrors(
      form,
      validationError([
        { path: ['trigger', 'config', 'owner'], message: 'Owner is required' },
        { path: ['trigger', 'config', 'repo'], message: 'Repo is required' },
      ]),
    );
    expect(form.controls.trigger.controls.repo.getError('zod')).toBe('Owner is required');
  });

  it('the field error clears when the user edits the field', () => {
    const name = form.controls.name;
    applyValidationErrors(form, validationError([{ path: ['name'], message: 'Too long' }]));
    expect(name.invalid).toBeTrue();

    name.setValue('Renamed');
    expect(name.errors).toBeNull();
    expect(form.valid).toBeTrue();
  });

  it('returns the first unmapped issue message, still applying the mapped ones', () => {
    const message = applyValidationErrors(
      form,
      validationError([
        { path: ['appId'], message: 'Unknown app' },
        { path: ['name'], message: 'Too long' },
        { path: ['trigger', 'app'], message: 'Other' },
      ]),
    );
    expect(message).toBe('Unknown app');
    expect(form.controls.name.getError('zod')).toBe('Too long');
  });

  it('without usable details, returns the error message', () => {
    expect(applyValidationErrors(form, validationError(undefined, 'Malformed JSON body'))).toBe('Malformed JSON body');
    expect(applyValidationErrors(form, new ApiError(400, 'VALIDATION_ERROR', 'Bad', [{ nope: 1 }]))).toBe('Bad');
    expect(form.valid).toBeTrue();
  });
});

describe('ZapBuilderComponent save → VALIDATION_ERROR', () => {
  const SAVED = makeZap();
  let zaps: jasmine.SpyObj<ZapsService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  function render(id: string | null) {
    zaps = jasmine.createSpyObj<ZapsService>('ZapsService', ['get', 'create', 'update']);
    const zap$ = new Subject<ZapDto>();
    zaps.get.and.returnValue(zap$);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['show']);
    TestBed.configureTestingModule({
      imports: [ZapBuilderComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(id ? { id } : {}),
              queryParamMap: convertToParamMap(id ? {} : { appId: GITHUB.id }),
            },
          },
        },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB]) } },
        { provide: GithubService, useValue: { getRepos: () => of([REPO]) } },
        { provide: ZapsService, useValue: zaps },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    const fixture = TestBed.createComponent(ZapBuilderComponent);
    fixture.detectChanges();
    if (id) {
      zap$.next(SAVED);
      zap$.complete();
      fixture.detectChanges();
    }
    const el = fixture.nativeElement as HTMLElement;
    const form = fixture.componentInstance.form!;
    const save = () => {
      el.querySelector<HTMLButtonElement>('button.save')!.click();
      fixture.detectChanges();
    };
    return { fixture, el, form, save };
  }

  function contextOf(spy: jasmine.Spy): HttpContext {
    const args = spy.calls.mostRecent().args;
    return args[args.length - 1] as HttpContext;
  }

  it('create: a body issue shows under the comment, Save stays off until it is edited', () => {
    const { fixture, el, form, save } = render(null);
    zaps.create.and.returnValue(
      throwError(() => validationError([{ path: ['action', 'config', 'body'], message: 'Unknown token {{pr.nope}}' }])),
    );
    form.controls.trigger.controls.repo.setValue(REPO);
    form.markAsDirty();
    fixture.detectChanges();
    save();

    expect(contextOf(zaps.create).get(HANDLED_ERROR_CODES)).toContain('VALIDATION_ERROR');
    expect(form.controls.action.controls.body.getError('zod')).toBe('Unknown token {{pr.nope}}');
    expect(el.querySelector('app-action-step mat-error')?.textContent).toContain('Unknown token {{pr.nope}}');
    expect(notifications.show).not.toHaveBeenCalled();
    expect(form.dirty).toBeTrue();
    expect(el.querySelector<HTMLButtonElement>('button.save')!.disabled).toBeTrue();

    form.controls.action.controls.body.setValue('Thanks!');
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('button.save')!.disabled).toBeFalse();
  });

  it('edit: a name issue shows under the name; an unknown path goes to a snackbar', () => {
    const { fixture, el, form, save } = render(SAVED.id);
    zaps.update.and.returnValue(
      throwError(() =>
        validationError([
          { path: ['name'], message: 'Name must be at most 100 characters' },
          { path: ['appId'], message: "App doesn't match the trigger app github" },
        ]),
      ),
    );
    form.controls.name.setValue('Renamed');
    form.markAsDirty();
    fixture.detectChanges();
    save();

    expect(zaps.update).toHaveBeenCalledOnceWith(SAVED.id, { name: 'Renamed' }, jasmine.any(HttpContext));
    expect(contextOf(zaps.update).get(HANDLED_ERROR_CODES)).toContain('VALIDATION_ERROR');
    expect(el.querySelector('.header mat-error')?.textContent).toContain('Name must be at most 100 characters');
    expect(notifications.show).toHaveBeenCalledOnceWith("App doesn't match the trigger app github");
  });

  it('edit: a repo issue shows its message under the repository', () => {
    const { fixture, el, form, save } = render(SAVED.id);
    zaps.update.and.returnValue(
      throwError(() => validationError([{ path: ['trigger', 'config', 'repo'], message: 'Repo is required' }])),
    );
    form.controls.trigger.controls.repo.setValue({ ...REPO, repo: 'other', fullName: 'acme/other' });
    form.markAsDirty();
    fixture.detectChanges();
    save();

    expect(el.querySelector('app-trigger-step mat-error')?.textContent).toContain('Repo is required');
  });

  it('other errors are left to the interceptor', () => {
    const { fixture, form, save } = render(null);
    zaps.create.and.returnValue(throwError(() => new ApiError(502, 'GITHUB_ERROR', 'boom')));
    form.controls.trigger.controls.repo.setValue(REPO);
    form.markAsDirty();
    fixture.detectChanges();
    save();

    expect(notifications.show).not.toHaveBeenCalled();
    expect(form.valid).toBeTrue();
  });
});
