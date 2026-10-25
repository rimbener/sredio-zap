import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../environments/environment';
import { BrowserLocationService } from '../core/browser-location.service';

/** Login screen (Screens.md → Login). The `?error=` messages arrive with E1/E2. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  static readonly SIGN_IN_URL = `${environment.apiUrl}/auth/github`;

  constructor(private readonly location: BrowserLocationService) {}

  /** OAuth needs a browser redirect, so this is a full-page navigation, not an XHR. */
  signIn(): void {
    this.location.assign(LoginComponent.SIGN_IN_URL);
  }
}
