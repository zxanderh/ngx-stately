import 'reflect-metadata';
import { inject, Injector, runInInjectionContext } from '@angular/core';
import { getPropertiesWithMetadata, STATELY_OPTIONS, StorageVarSignal } from '../util/util';
import { storageVar } from '../signals/var';
import { StatelyService } from '../service/stately.service';
import { Constructor } from 'type-fest';

export function Store(target: any) {
  // we just need to do something here. Doesn't really matter what.
  target[STATELY_OPTIONS] = true;
}

/**
 * Decorator factory that turns a class into a storage-backed store by wiring signals for each
 * constructor parameter and keeping them synced via the supplied storage implementation.
 */
export abstract class DecoratedStore {
  abstract storage: Storage;
  private __injector = inject(Injector);
  private signals: Record<string, StorageVarSignal<any>> = {};
  private _initialized: Record<string, boolean> = {};

  constructor() {
    const ctor = this.constructor as Constructor<DecoratedStore>;
    const props = getPropertiesWithMetadata(ctor);

    for (const [key] of Object.entries(props)) {
      Object.defineProperty(this, key, {
        configurable: true,
        get: () => {
          // ToDo this can't ever happen because typescript always initializes these properties. Right?
          // if (this.signals[key] == null) {
          //   // Lazy initialization: create storage-backed signal on first access
          //   // This happens when the property is read before being set
          //   const defaultValue = this.defaults?.[key];
          //   // Get injector (either from constructor or inject it now)
          //   const injector = this.__injector || inject(Injector);
          //   // Use runInInjectionContext to ensure storageVar can inject StatelyService
          //   this.signals[key] = runInInjectionContext(injector, () => {
          //     return storageVar({
          //       key,
          //       storage,
          //       default: defaultValue,
          //     });
          //   });
          //   // Register the signal to set up persistence effect
          //   const service = injector.get(StatelyService);
          //   service.register(this.signals[key]);
          //   this._initialized[key] = true;
          // }
          return this.signals[key]();
        },
        set: (value) => {
          const isFirstSet = this.signals[key] == null;

          if (isFirstSet) {
            // First set: create signal and check storage
            const injector = this.__injector || inject(Injector);
            this.signals[key] = runInInjectionContext(injector, () => {
              return storageVar({
                key,
                storage: this.storage,
                default: value,
              });
            });
            const service = injector.get(StatelyService);
            service.register(this.signals[key]);

            // Check if storage had a value
            const storedValue = this.storage.getItem(key);
            const currentValue = this.signals[key]();

            // ToDo this isn't possible, right?
            // Only set the constructor value if storage was empty
            // If storage had a value, storageVar already used it, so we keep it
            if (storedValue == null && currentValue !== value) {
              this.signals[key].set(value);
            }

            this._initialized[key] = true;
          } else {
            // Subsequent sets: always update the value
            this.signals[key].set(value);
          }
          return value;
        },
      });
    }
  }
}


export class SessionStore extends DecoratedStore {
  storage = sessionStorage;
}


export class LocalStore extends DecoratedStore {
  storage = localStorage;
}
