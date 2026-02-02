import { effect, inject, Injectable, Injector, signal, CreateEffectOptions, assertInInjectionContext, makeEnvironmentProviders, runInInjectionContext } from '@angular/core';
import { attachToSignal, isStorageVarSignal, StandaloneStorageVarOptions, STATELY_OPTIONS, StorageVarSignal } from '../util/util';
import { deserialize, serialize } from '../util/serialization';
import { Constructor } from 'type-fest';

type StorageRecord<T extends string = string> = Record<T, Storage>;

// export const STORAGE_RECORD = new InjectionToken<StorageRecord>('STORAGE_RECORD');

type GetSetter = (<T>(key: string, ctor?: Constructor<T>) => T) & { set<T>(key: string, value: T): void; };

export function provideStately(options?: { statelyService?: Constructor<StatelyService>; services?: any[] }) {
  options ||= {};
  options.statelyService ||= DefaultStatelyService;
  const srvcs: Parameters<typeof makeEnvironmentProviders>[0] = [];
  if (options.services != null) {
    for (const service of options.services) {
      let instance;
      srvcs.push({
        provide: service,
        deps: [Injector, StatelyService],
        useFactory: (injector: Injector, stately: StatelyService) => instance ||= runInInjectionContext(Injector.create({providers: [{provide: StatelyService, useValue: stately}], parent: injector}), () => Reflect.construct(service, [])),
      });
    }
  }
  return makeEnvironmentProviders([
    { provide: StatelyService, useClass: options.statelyService },
    ...srvcs,
  ]);
}

export function statelyStorage(name: string, storage: Storage, statelyService?: StatelyService) {
  const service = statelyService || inject(StatelyService);
  return StatelyService.prototype.registerStorage.call(service, name, storage);
}

@Injectable()
export class StatelyService {
  private injector = inject(Injector);
  private storages = {} as StorageRecord;
  private storageNames = new Map<Storage, string>();
  signals = {} as Record<string, Record<string, StorageVarSignal<unknown>>>;

  registerStorage(name: string, storage: Storage) {
    this.signals[name] = {};
    this.storages[name] = storage;

    // add storage to storage name lookup
    this.storageNames.set(this.storages[name], name);

    // set up getter setter
    const getterSetter = function(this: StatelyService, key: string, ctor?: Constructor<unknown>) {
      return this.getOrCreateSignal(name, key, { ctor })();
    } as GetSetter;
    getterSetter.set = (key: string, value: unknown) => {
      this.getOrCreateSignal(name, key, { force: true }).set(value);
    };

    return getterSetter;
  }

  private getOrCreateSignal(storageName: string, key: string, options: { default?: unknown; ctor?: Constructor<unknown>; force?: boolean }) {
    if (this.signals[storageName][key] == null) {
      const storage = this.storages[storageName];
      const varOptions: StandaloneStorageVarOptions<unknown> = {
        default: options.default,
        initialized: false,
        key,
        storage,
      };
      // retrieve value from storage
      let value: unknown = storage.getItem(key);
      // if value present, deserialize. If not, fall back to default.
      value = value != null
        ? deserialize(
            value,
            options.ctor || null,
            key,
          )
        : varOptions.default
      ;
      // create signal and attach stately options
      const signal$ = signal(value, varOptions);
      const varSignal = attachToSignal(signal$, varOptions);
      // register with stately service
      this.register(varSignal, options.force);
      // store signal for future lookups
      this.signals[storageName][key] = varSignal;
      return varSignal;
    }
    return this.signals[storageName][key];
  }

  public getStorageName(storage: Storage) {
    return this.storageNames.get(storage) || null;
  }

  public register = (signalToRegister: StorageVarSignal<any>, force?: boolean) => {
    if (isStorageVarSignal(signalToRegister) && !signalToRegister[STATELY_OPTIONS].initialized) {
      const options = signalToRegister[STATELY_OPTIONS];

      const effectOptions: CreateEffectOptions = {};
      try {
        assertInInjectionContext(StatelyService.prototype.register);
      } catch {
        effectOptions.injector = this.injector;
      }

      let firstCheck = !force;
      effect(() => {
        const value = signalToRegister();
        if (!firstCheck) { // don't update on first
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          options.storage!.setItem(options.key, serialize(value));
        } else {
          firstCheck = false;
        }
      }, effectOptions);
      options.initialized = true;
    }
  };
}

@Injectable()
export class DefaultStatelyService extends StatelyService {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  session = statelyStorage('session', sessionStorage, this)!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  local = statelyStorage('local', localStorage, this)!;
}
