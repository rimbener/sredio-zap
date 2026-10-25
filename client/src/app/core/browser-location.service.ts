import { Injectable } from '@angular/core';

/** Full-page navigation (`window.location.href`), wrapped so specs can replace it. */
@Injectable({ providedIn: 'root' })
export class BrowserLocationService {
  assign(url: string): void {
    window.location.href = url;
  }
}
