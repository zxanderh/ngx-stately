import { effect, inject, Injectable, Injector, signal, CreateEffectOptions, assertInInjectionContext, InjectionToken, makeEnvironmentProviders, runInInjectionContext } from "@angular/core";
import { attachToSignal, isStorageVarSignal, StandaloneStorageVarOptions, STATELY_OPTIONS, StorageVarSignal } from "../util/util";
import { deserialize, serialize } from "../util/serialization";
import { Constructor } from "type-fest";

// interface StorageRecord {
//   [name: string]: Storage;
// }

type StorageRecord<T extends string = string> = Record<T, Storage>;

export const STORAGE_RECORD = new InjectionToken<StorageRecord>('STORAGE_RECORD');

type GetSetter = (<T>(key: string, ctor?: Constructor<T>) => T) & { set<T>(key: string, value: T): void; };

export type CustomStatelyService<T extends StorageRecord> = {
  [k in keyof T]: GetSetter;
} & StatelyService<T>;

export function provideStately(storages?: StorageRecord, services?: any[]) {
  if (storages == null) {
    storages = { session: sessionStorage };
    if (typeof localStorage !== 'undefined') {
      storages['local'] = localStorage;
    }
  }
  const srvcs: Parameters<typeof makeEnvironmentProviders>[0] = [];
  if (services != null) {
    for (const service of services) {
      let instance;
      srvcs.push({
        provide: service,
        deps: [Injector, StatelyService],
        useFactory: (injector: Injector, stately: StatelyService) => instance ||= runInInjectionContext(Injector.create({providers: [{provide: StatelyService, useValue: stately}], parent: injector}), () => Reflect.construct(service, [])),
      });
    }
  }
  return makeEnvironmentProviders([
    { provide: STORAGE_RECORD, useValue: storages },
    { provide: StatelyService, deps: [STORAGE_RECORD] },
    ...srvcs,
  ]);
}

@Injectable()
export class StatelyService<T extends StorageRecord = StorageRecord<'session'|'local'>> {
  private injector = inject(Injector);
  private storages = inject(STORAGE_RECORD) as T;
  private storageNames = new Map<Storage, keyof T>;
  signals = {} as Record<keyof T, Record<string, StorageVarSignal<unknown>>>;

  private get self() { return this as CustomStatelyService<T>; }

  constructor() {
    for (const name in this.storages) {
      if (!Object.prototype.hasOwnProperty.call(this.storages, name)) continue;

      // create object to store signals for this storage type
      this.signals[name] = {};

      // add storage to storage name lookup
      this.storageNames.set(this.storages[name], name);

      // set up getter setter
      // ToDo fix type
      // @ts-expect-error todo
      this.self[name] = function(this: StatelyService<T>, key: string, ctor?: Constructor<unknown>) {
        return this.getOrCreateSignal(name, key, { ctor })();
      } as GetSetter;
      this.self[name].set = (key: string, value: unknown) => {
        this.getOrCreateSignal(name, key, { force: true }).set(value);
      };
    }
  }

  private getOrCreateSignal(storageName: keyof T, key: string, options: { default?: unknown; ctor?: Constructor<unknown>; force?: boolean }) {
    if (this.self.signals[storageName][key] == null) {
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
      // ToDo fix type
      // @ts-expect-error todo
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
