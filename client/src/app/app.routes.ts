import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';
import { unsavedChangesGuard } from './zaps/zap-builder/unsaved-changes.guard';

/**
 * Every route from Screens.md → Routes. Slices fill in the components; they
 * don't edit this file (E10 adds `canDeactivate: [unsavedChangesGuard]` to the
 * two builder routes).
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: '/zaps',
      },
      {
        path: 'zaps',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./zaps/zap-list/zap-list.component').then(
            (m) => m.ZapListComponent,
          ),
      },
      {
        path: 'zaps/new',
        canActivate: [authGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./zaps/zap-builder/zap-builder.component').then(
            (m) => m.ZapBuilderComponent,
          ),
      },
      {
        path: 'zaps/:id',
        canActivate: [authGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./zaps/zap-builder/zap-builder.component').then(
            (m) => m.ZapBuilderComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'zaps' },
];
