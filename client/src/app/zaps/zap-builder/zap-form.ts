import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { AppDto, CreateZapInput, RepoDto, createZapSchema, pullRequestCommentConfigSchema } from '@zaps/shared';

/** Default comment in create mode (Screens.md → Action card). */
export const DEFAULT_COMMENT_BODY = 'Thanks @{{pr.author}} for opening this pull request!';
export const DEFAULT_ZAP_NAME = 'Untitled Zap';

/** A repo picked from the list, or the text typed in the autocomplete (invalid until picked). */
export type RepoValue = RepoDto | string | null;

export type TriggerForm = FormGroup<{
  event: FormControl<string>;
  repo: FormControl<RepoValue>;
}>;

export type ActionForm = FormGroup<{
  event: FormControl<string>;
  body: FormControl<string>;
}>;

export type ZapForm = FormGroup<{
  name: FormControl<string>;
  trigger: TriggerForm;
  action: ActionForm;
}>;

export type ZapFormValue = ReturnType<ZapForm['getRawValue']>;

/** The part of a zod schema the validators use (keeps `zod` itself out of the client's imports). */
type SafeParser = {
  safeParse(value: unknown): { success: true } | { success: false; error: { issues: { code: string; message: string }[] } };
};

/**
 * Runs a shared zod schema on a control's value. The error is `{ zod: message }`, with
 * `messages[issue.code]` replacing zod's default text when given.
 */
export function zodValidator(schema: SafeParser, messages: Record<string, string> = {}): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = schema.safeParse(control.value);
    if (result.success) return null;
    const issue = result.error.issues[0];
    return { zod: messages[issue.code] ?? issue.message };
  };
}

export function isRepo(value: RepoValue): value is RepoDto {
  return typeof value === 'object' && value !== null && typeof value.owner === 'string' && typeof value.repo === 'string';
}

/** The repo must be picked from the list; free text is invalid (Screens.md → Trigger card). */
export const repoPickedValidator: ValidatorFn = (control) =>
  isRepo(control.value) ? null : { repoNotPicked: true };

/** The `POST /api/zaps` body for the form's current value. Action steps use the Zap's app. */
export function toCreateZapInput(app: AppDto, value: ZapFormValue): CreateZapInput {
  const repo = isRepo(value.trigger.repo) ? value.trigger.repo : { owner: '', repo: '' };
  return {
    appId: app.id,
    name: value.name,
    trigger: { app: app.key, event: value.trigger.event, config: { owner: repo.owner, repo: repo.repo } },
    action: { app: app.key, event: value.action.event, config: { body: value.action.body } },
  };
}

/** Form-level check with the same zod schema the server uses (step configs, tokens, …). */
function zapSchemaValidator(app: AppDto): ValidatorFn {
  return (control) => {
    const result = createZapSchema.safeParse(toCreateZapInput(app, (control as ZapForm).getRawValue()));
    return result.success ? null : { zap: result.error.issues };
  };
}

const NAME_SCHEMA = createZapSchema.innerType().shape.name;
const BODY_SCHEMA = pullRequestCommentConfigSchema.shape.body;

/** The builder's form in create mode, for a Zap starting with `app`. */
export function createZapForm(app: AppDto): ZapForm {
  return new FormGroup(
    {
      name: new FormControl(DEFAULT_ZAP_NAME, {
        nonNullable: true,
        validators: zodValidator(NAME_SCHEMA, {
          too_small: 'Name is required',
          too_big: 'Name must be at most 100 characters',
        }),
      }),
      trigger: new FormGroup({
        event: new FormControl(app.triggers[0]?.key ?? '', { nonNullable: true, validators: Validators.required }),
        repo: new FormControl<RepoValue>(null, repoPickedValidator),
      }),
      action: new FormGroup({
        event: new FormControl(app.actions[0]?.key ?? '', { nonNullable: true, validators: Validators.required }),
        body: new FormControl(DEFAULT_COMMENT_BODY, {
          nonNullable: true,
          validators: zodValidator(BODY_SCHEMA, {
            too_small: 'Comment is required',
            too_big: 'Comment must be at most 65,536 characters',
          }),
        }),
      }),
    },
    { validators: zapSchemaValidator(app) },
  );
}
