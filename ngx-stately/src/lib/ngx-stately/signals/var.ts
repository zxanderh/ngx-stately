import { assertInInjectionContext, effect, inject, signal, WritableSignal } from '@angular/core';
import { STATELY_OPTIONS, STORAGE, StorageVarOptions, StorageVarSignal } from '../util/util';
import { attempt, isError } from 'lodash-es';
import { deserialize, serialize } from '../util/serialization';

export interface StandaloneStorageVarOptions<T> extends StorageVarOptions<T> {
  storage?: Storage;
}

function supplementOptionsAndDetermineInjectionContext<T>(options: StandaloneStorageVarOptions<T>) {
  let inInjectionContext = false;
  if (!options.storage && !isError(attempt(() => assertInInjectionContext(supplementOptionsAndDetermineInjectionContext)))) {
    inInjectionContext = true;
    options.storage = inject(STORAGE);
  }
  return inInjectionContext;
}

export function attachToSignal<T>(signalToAttach: WritableSignal<T | undefined>, options: StandaloneStorageVarOptions<T>, inInjectionContext?: boolean) {
  // check injection context if needed
  if (inInjectionContext == null) {
    inInjectionContext = supplementOptionsAndDetermineInjectionContext(options);
  }

  // if in injection context, declare effect. Otherwise, syncing to storage is handled by owning service
  let firstCheck = true;
  if (inInjectionContext) {
    effect(() => {
      const value = signalToAttach();
      if (!firstCheck) { // don't update on first
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        options.storage!.setItem(options.key, serialize(value));
      } else {
        firstCheck = false;
      }
    });
    options.initialized = true;
  }
  const statelySignal = signalToAttach as StorageVarSignal<T>;
  statelySignal[STATELY_OPTIONS] = options;
  return statelySignal;
}

export function storageVar<T>(options: StandaloneStorageVarOptions<T>): StorageVarSignal<T> {
  const inInjectionContext = supplementOptionsAndDetermineInjectionContext(options);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const value = deserialize<T>(options.storage!.getItem(options.key), null, options.key) ?? options.default;
  const sig = signal(value);
  return attachToSignal(sig, options, inInjectionContext);
}

export function generateStorageVarCreator(storage: Storage) {
  return <T>(options: StorageVarOptions<T>) => storageVar<T>({ ...options, storage });
}

export const sessionVar = generateStorageVarCreator(sessionStorage);
export const localVar = generateStorageVarCreator(localStorage);

