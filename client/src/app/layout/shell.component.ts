import { AsyncPipe, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

/** Toolbar plus router outlet, shown on every screen except Login (Screens.md → App shell). */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [AsyncPipe, NgIf, MatButtonModule, MatMenuModule, MatToolbarModule, RouterLink, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {
  readonly user$ = this.auth.user$;

  constructor(private readonly auth: AuthService) {}

  /** Sign out arrives with S2. */
  onSignOut(): void {}
}
