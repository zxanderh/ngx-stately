import { signal, Injectable, TypeDecorator } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import 'reflect-metadata';
import { toObservable } from '@angular/core/rxjs-interop';
import { getPropertiesWithMetadata } from '../util/util';
import { deserialize, serialize } from '../util/serialization';

type InjectableStore = Injectable & { storeParams?: boolean; debounceTime?: number };
type UnboundInjectableStore = InjectableStore & { storage: Storage };

export function Store(options: UnboundInjectableStore): TypeDecorator {
  const { storeParams, storage, providedIn, debounceTime: $debounceTime } = options;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctor: any) => {
    // signals container
    Object.defineProperty(ctor.prototype, 'signals', {
      get() {
        return (this._signals ||= {});
      },
    });
    // default values container
    Object.defineProperty(ctor.prototype, 'defaults', {
      get() {
        return (this._defaults ||= {});
      },
    });
    // subscription sink for easy unsubscribe
    Object.defineProperty(ctor.prototype, 'sub', {
      get() {
        return (this._sub ||= new Subscription());
      },
    });

    if (storeParams) {
      const props = getPropertiesWithMetadata(ctor);

      for (const [key, constr] of Object.entries(props)) {
        Object.defineProperty(ctor.prototype, key, {
          get() {
            return this.signals[key]();
          },
          set(value) {
            if (this.signals[key] == null) {
              this.defaults[key] = value;
              const stored = storage.getItem(key);
              if (stored != null) {
                value = deserialize(stored, constr, key);
              }
              this.signals[key] = signal(value);
              this.sub.add(
                toObservable(this.signals[key])
                  .pipe(distinctUntilChanged(), debounceTime($debounceTime ?? 500))
                  .subscribe((val) => {
                    if (val !== value) {
                      // if changed from default value
                      storage.setItem(key, serialize(val));
                    }
                  })
              );
            }
            this.signals[key].set(value);
            return value;
          },
        });
      }
    }

    return Injectable({ providedIn: providedIn || null })(ctor);
  };
}

export function SessionStore(options: InjectableStore) {
  return Store({
    ...options,
    storage: sessionStorage,
  } as UnboundInjectableStore);
}
export function LocalStore(options: InjectableStore) {
  const storage =
    typeof localStorage === 'undefined' ? sessionStorage : localStorage;
  return Store({
    ...options,
    storage,
  } as UnboundInjectableStore);
}
