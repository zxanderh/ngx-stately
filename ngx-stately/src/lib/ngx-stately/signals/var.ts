import { inject } from '@angular/core';
import { getGlobalOrThrow, isLazyRef, lazyRef, LazyRef, StandaloneStorageVarOptions, StorageVarOptions, StorageVarSignal } from '../util/util';
import { StatelyService } from '../service/stately.service';

/** Creates a signal that bootstraps its initial value from storage and keeps it in sync. */
export function storageVar<T>(options: StandaloneStorageVarOptions<T | undefined>): StorageVarSignal<T | undefined> {
  const service = inject(StatelyService);
  return service.createLinked(options);
}

/** Factory builder that locks a storage implementation for future `storageVar` instances. */
export function generateStorageVarCreator(storage: Storage | LazyRef<Storage>) {
  return <T>(options: StorageVarOptions<T | undefined>) => storageVar<T | undefined>({
    storage: isLazyRef(storage) ? storage.value() : storage,
    ...options,
  });
}

/** Convenience helper that persists signal state in `sessionStorage`. */
export const sessionVar = generateStorageVarCreator(lazyRef(() => getGlobalOrThrow('sessionStorage')));
/** Convenience helper that persists signal state in `localStorage`. */
export const localVar = generateStorageVarCreator(lazyRef(() => getGlobalOrThrow('localStorage')));
