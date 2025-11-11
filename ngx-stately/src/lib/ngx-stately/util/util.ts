import { CreateSignalOptions, InjectionToken, isSignal, signal, WritableSignal } from '@angular/core';
import { Constructor } from 'type-fest';

export const STATELY_OPTIONS = Symbol('STATELY_OPTIONS');

export const storages: Record<string, Storage> = {};

export function registerStorage(id: string, storage: Storage): void {
  storages[id] = storage;
}

export const STORAGE = new InjectionToken<Storage>('STATELY_STORAGE');

export interface StorageVarOptions<T> extends CreateSignalOptions<T> {
  default?: T;
  key: string;
  initialized?: boolean;
}

export type StorageVarSignal<T> = WritableSignal<T> & { [STATELY_OPTIONS]: StorageVarOptions<T> };

export function isStorageVarSignal(val: unknown): val is StorageVarSignal<unknown> {
  if (isSignal(val) && STATELY_OPTIONS in val && val[STATELY_OPTIONS] != null) {
    return true;
  }
  return false;
}

let SIGNAL: symbol;
(() => {
  const sig = signal(0);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  SIGNAL = Object.getOwnPropertySymbols(sig).find((s: symbol) => s.description === 'SIGNAL')!;
})();
export { SIGNAL };

export function getPropertiesWithMetadata(
  target: Constructor<unknown>
): Record<string, Constructor<unknown>> {
  const types = Reflect.getMetadata('design:paramtypes', target);
  return Object.getOwnPropertyNames(new target())
    .filter((key) => key !== 'constructor')
    .reduce((acc, key, i) => {
      if (i + 1 <= types.length) {
        acc[key] = types[i] || null;
      }
      return acc;
    }, {} as Record<string, Constructor<unknown>>);
}

export function isPrimitiveConstructor(
  value: unknown
): value is
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | SymbolConstructor {
  if (value == null) return false;
  return (
    value === String ||
    value === Number ||
    value === Boolean ||
    value === Symbol
  );
}

export function mockStorage(name: string, globalize = true) {
  const out: Storage = (() => {
    let store: Record<string, string> = {};

    return {
      getItem(key) {
        return store[key] || null;
      },
      setItem(key, value) {
        store[key] = value.toString();
      },
      removeItem(key) {
        delete store[key];
      },
      clear() {
        store = {};
      },
      key(n: number) {
        return Object.keys(store)[n];
      },
      get length() {
        return Object.keys(store).length;
      },
    };
  })();
  Object.defineProperty(out, 'name', { value: name, configurable: false, enumerable: false });

  if (globalize) {
    (globalThis as Record<string, unknown>)[name] = out;
  }

  return out;
}
