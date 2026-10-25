import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';
import { NotificationService } from './core/notification.service';

describe('AppComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: appConfig.providers,
    }),
  );

  it('renders a router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).not.toBeNull();
  });

  it('provides the snackbar and dialog app-wide', () => {
    expect(TestBed.inject(NotificationService)).toBeTruthy();
    expect(TestBed.inject(MatDialog)).toBeTruthy();
  });
});
