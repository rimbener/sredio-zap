/** AES-256-GCM output, all base64 strings (Data-model.md → Shared type `EncryptedValue`). */
export type EncryptedValue = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type UserDto = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
};

export type AppStatus = 'available' | 'coming_soon';

/** A trigger or action an app offers, as listed in the app catalog. */
export type AppEventDto = {
  key: string;
  name: string;
  description: string;
};

export type AppDto = {
  id: string;
  key: string;
  name: string;
  icon: string;
  status: AppStatus;
  order: number;
  triggers: AppEventDto[];
  actions: AppEventDto[];
};

export type ZapStep = {
  app: string;
  event: string;
  config: Record<string, unknown>;
};

export type ZapDto = {
  id: string;
  appId: string;
  name: string;
  enabled: boolean;
  trigger: ZapStep;
  action: ZapStep;
  createdAt: string;
  updatedAt: string;
};

export type ZapRunStatus = 'pending' | 'success' | 'failed';

export type ZapRunDto = {
  id: string;
  status: ZapRunStatus;
  input: { prNumber: number; prUrl: string };
  output: { commentUrl: string } | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RepoDto = {
  /** Same names as the trigger config `{ owner, repo }`. */
  owner: string;
  repo: string;
  fullName: string;
  htmlUrl: string;
};
