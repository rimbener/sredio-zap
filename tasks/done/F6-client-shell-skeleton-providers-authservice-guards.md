# F6. Client shell skeleton: providers, AuthService, guards, interceptor, routes

- **Goal:** The Angular app boots into a shell with a toolbar, knows whether the user is signed in, and routes to placeholder screens.
- **Scope in:**
  - `app.config.ts`: `provideRouter`, `provideHttpClient(withInterceptors([httpErrorInterceptor]))`, `provideAnimations`. `environment.ts` already has `apiUrl: 'http://localhost:3000'` (boilerplate). Every request uses `withCredentials: true` (set in the interceptor).
  - `AuthService`: `BehaviorSubject<UserDto | null | undefined>` (unknown / signed out / user), calls `GET /api/me` once and caches; a `401` there is cached as `null`, not an error. `setSignedOut()`.
  - `authGuard` and `guestGuard` (functional).
  - `httpErrorInterceptor`: skips `GET /api/me`; parses the envelope into an `ApiError`; shows a snackbar with the text from `error-messages.ts` for every code in Screens.md → Error handling; network error → "Something went wrong. Try again." Provides an `HttpContextToken` for call sites that handle certain codes themselves. No redirects yet (E1, E2).
  - `NotificationService` wrapping `MatSnackBar`.
  - `ShellComponent` with `mat-toolbar` ("⚡ Zaps" link to `/zaps`) and router outlet; avatar menu placeholder.
  - `app.routes.ts` with all routes from Screens.md → Routes and placeholder components at their final paths; `**` → `/zaps`.
  - `ConfirmDialogComponent` (generic title/message/confirm label), used by S9, S11 and E10.
  - `indigo-pink` theme in `angular.json`/styles.
- **Scope out:** login page content (S1), sign out (S2), `UNAUTHENTICATED`/`GITHUB_AUTH_REQUIRED` redirects (E1/E2), unsaved guard (E10).
- **Touches:** client: `app.config.ts`, `app.routes.ts`, `environments/`, `core/*`, `layout/shell.component.*`, `shared/confirm-dialog.component.*`, placeholder components.
- **Depends on:** F1 for DTO types (can stub until it lands).
- **Doc refs:** Screens.md → Navigation, Routes, App shell, Error handling, Component structure; Tech-Stack.md → Client.
- **Acceptance (Karma/Jasmine):** `AuthService` caches `/api/me` (one request for many subscribers) and maps `401` to `null`; `authGuard` redirects `null` to `/login`; `guestGuard` redirects a user to `/zaps`; interceptor adds `withCredentials`, skips `/api/me`, shows the mapped snackbar text, respects the opt-out token. `ng build` passes. Manual: `ng serve` shows the toolbar on `/zaps` (placeholder).
- **Size:** M
