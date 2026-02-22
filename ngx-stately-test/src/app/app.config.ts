import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideStately } from 'ngx-stately';
import { LocalStoreService } from '../services/localStore';
import { SessionStoreService } from '../services/sessionStore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideStately(),
    LocalStoreService,
    SessionStoreService,
  ],
};
