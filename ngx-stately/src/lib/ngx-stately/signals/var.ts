import { inject, signal } from '@angular/core';
import { attachToSignal, DetailedError, StandaloneStorageVarOptions, StorageVarOptions, StorageVarSignal } from '../util/util';
import { deserialize } from '../util/serialization';
import { StatelyService } from '../service/stately.service';
import { Constructor } from 'type-fest';

/** Creates a signal that bootstraps its initial value from storage and keeps it in sync. */
export function storageVar<T>(options: StandaloneStorageVarOptions<T | undefined>): StorageVarSignal<T | undefined> {
  const service = inject(StatelyService);
  const storageName = service.getStorageName(options.storage);
  if (!storageName) {
    throw new DetailedError('Storage not registered with StatelyService!', { storage: options.storage, signalOptions: options });
  }
  if (service.signals[storageName][options.key] == null) {
    const tmp = options.storage.getItem(options.key);
    const value = tmp != undefined
      ? deserialize<T>(tmp, options.default?.constructor as Constructor<T>, options.key)
      : options.default
    ;
    const sig = signal<T | undefined>(value, options);
    const varSig = attachToSignal(sig, options);
    service.register(varSig);
    return varSig;
  }
  return service.signals[storageName][options.key] as StorageVarSignal<T | undefined>;
}

/** Factory builder that locks a storage implementation for future `storageVar` instances. */
export function generateStorageVarCreator(storage: Storage) {
  return <T>(options: StorageVarOptions<T | undefined>) => storageVar<T | undefined>({ storage, ...options });
}

/** Convenience helper that persists signal state in `sessionStorage`. */
export const sessionVar = generateStorageVarCreator(sessionStorage);
/** Convenience helper that persists signal state in `localStorage`. */
export const localVar = generateStorageVarCreator(localStorage);
