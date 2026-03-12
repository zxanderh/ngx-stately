import { effect, inject, Injectable, signal, assertInInjectionContext, makeEnvironmentProviders, linkedSignal, Injector } from '@angular/core';
import { attachToSignal, DetailedError, MultiKeyMap, StandaloneStorageVarOptions, StorageVarRootSignal, StorageVarSignal } from '../util/util';
import { deserialize, serialize } from '../util/serialization';
import { Constructor } from 'type-fest';

export function provideStately() {
  return makeEnvironmentProviders([ StatelyService ]);
}

@Injectable()
export class StatelyService {
  private injector = inject(Injector);
  rootSignals = new MultiKeyMap<Storage | 'mem', string, StorageVarRootSignal<unknown>>();

  private getOrCreateRootSignal(storage: Storage, key: string, options: { default?: unknown; ctor?: Constructor<unknown> }) {
    const existing = this.rootSignals.get(storage, key);
    if (existing == null) {
      const varOptions: StandaloneStorageVarOptions<unknown> & { root: true } = {
        default: options.default,
        initialized: false,
        key,
        storage,
        root: true,
      };
      // retrieve value from storage
      let value: unknown = storage.getItem(key);
      // if value present, deserialize. If not, fall back to default.
      value = value != null
        ? deserialize(
            value,
            options.ctor ?? (options.default as { constructor?: Constructor<unknown> } | undefined)?.constructor ?? null,
            key,
          )
        : varOptions.default
      ;
      // create signal and attach stately options
      const equal = varOptions.equal || Object.is;
      const signal$ = signal({ value, source: 'default' }, { ...varOptions, equal: (a, b) => equal(a.value, b.value) });
      const varSignal = attachToSignal(signal$, varOptions) as StorageVarRootSignal<unknown>;
      // store signal for future lookups
      this.rootSignals.set(storage, key, varSignal);
      effect(() => {
        const val = varSignal();
        if (val.source !== 'default') {
          storage.setItem(key, serialize(val.value));
        }
      }, { injector: this.injector }); // pass service injector so effect gets cleaned up in service OnDestroy
      return varSignal;
    }
    return existing;
  }

  public createLinked<T>(options: StandaloneStorageVarOptions<T | undefined>): StorageVarSignal<T | undefined> {
    assertInInjectionContext(StatelyService.prototype.createLinked);

    if (!options.storage) {
      throw new DetailedError('Invalid value for options.storage', { value: options.storage });
    }

    const rootSignal = this.getOrCreateRootSignal(options.storage, options.key, options);
    const signal$ = linkedSignal<T | undefined>(() => rootSignal().value as T | undefined, {
      equal: options.equal,
      debugName: options.debugName,
    });
    // ToDo fix type
    const varSignal = attachToSignal<T | undefined>(signal$ as any, options);
    effect(() => {
      const val = varSignal();
      rootSignal.set({ value: val, source: 'linked' });
    });
    return varSignal;
  };
}
