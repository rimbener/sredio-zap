import { NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import { BrowserLocationService } from '../core/browser-location.service';

/** Inline message per `?error=` value (Screens.md → Login); unknown values show nothing. */
export const LOGIN_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['oauth', 'Sign-in failed. Please try again.'],
]);

/** Login screen (Screens.md → Login). */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgIf, MatButtonModule, MatCardModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  static readonly SIGN_IN_URL = `${environment.apiUrl}/auth/github`;

  /** The message for the `?error=` query param, if any. */
  readonly errorMessage: string | null;

  constructor(
    private readonly location: BrowserLocationService,
    route: ActivatedRoute,
  ) {
    const error = route.snapshot.queryParamMap.get('error');
    this.errorMessage = (error && LOGIN_ERROR_MESSAGES.get(error)) || null;
  }

  /** OAuth needs a browser redirect, so this is a full-page navigation, not an XHR. */
  signIn(): void {
    this.location.assign(LoginComponent.SIGN_IN_URL);
  }
}
