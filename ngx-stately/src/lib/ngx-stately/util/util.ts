import { CreateSignalOptions, InjectionToken, isSignal, signal, WritableSignal } from '@angular/core';
import { Constructor } from 'type-fest';

/** Internal symbol used to stash storage metadata on signals. */
export const STATELY_OPTIONS = Symbol('STATELY_OPTIONS');

/** Injection token resolving to the storage backing the current stately context. */
export const STORAGE = new InjectionToken<Storage>('STATELY_STORAGE');

export interface StorageVarOptions<T> extends CreateSignalOptions<T> {
  default?: T;
  key: string;
  initialized?: boolean;
  storage?: Storage;
}

export interface StandaloneStorageVarOptions<T> extends StorageVarOptions<T> {
  storage: Storage;
}

/** Writable signal augmented with storage metadata so stores can bootstrap it. */
export type StorageVarSignal<T> = WritableSignal<T> & { [STATELY_OPTIONS]: StorageVarOptions<T> };

/** Type guard that checks if a value is a storage-aware signal produced by this library. */
export function isStorageVarSignal(val: unknown): val is StorageVarSignal<unknown> {
  if (isSignal(val) && STATELY_OPTIONS in val && val[STATELY_OPTIONS] != null) {
    return true;
  }
  return false;
}

/**
 * Wraps a signal with storage synchronization semantics and wires Angular effect.
 */
export function attachToSignal<T>(signalToAttach: WritableSignal<T | undefined>, options: StandaloneStorageVarOptions<T>) {
  const statelySignal = signalToAttach as StorageVarSignal<T>;
  statelySignal[STATELY_OPTIONS] = options;
  return statelySignal;
}

let SIGNAL: symbol;
(() => {
  const sig = signal(0);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  SIGNAL = Object.getOwnPropertySymbols(sig).find((s: symbol) => s.description === 'SIGNAL')!;
})();
/** Exposes Angular's internal signal symbol so helpers can poke metadata when necessary. */
export { SIGNAL };

/** Uses TypeScript's emitted metadata to map constructor params back to their types. */
// export function getPropertiesWithMetadata(
//   target: Constructor<unknown>
// ): Record<string, Constructor<unknown>> {
//   const types = Reflect.getMetadata('design:paramtypes', target);
//   return Object.getOwnPropertyNames(new target())
//     .filter((key) => key !== 'constructor')
//     .reduce((acc, key, i) => {
//       acc[key] = types[i] || null;
//       return acc;
//     }, {} as Record<string, Constructor<unknown>>);
// }

function getConstructorParamNames(target: Constructor<unknown>): string[] {
  // Works for both `class Foo { constructor(...) {} }` and `function Foo(...) {}`.
  const src = target.toString();

  // Try to match `constructor(...)` in class syntax
  let match = src.match(/constructor\s*\(([^)]*)\)/);

  // Fallback: match function-style constructor: `function Foo(...)`
  if (!match) {
    match = src.match(/^[^(]*\(([^)]*)\)/);
  }

  if (!match) {
    return [];
  }

  const argsSrc = match[1].trim();
  if (!argsSrc) {
    return [];
  }

  return argsSrc
    .split(',')
    .map((arg) => arg.trim())
    .filter((arg) => arg.length > 0)
    // Strip default values: `foo = 1` -> `foo`
    .map((arg) => arg.replace(/=[\s\S\r\n]*/, '').trim())
    // Only keep simple identifiers (no destructuring, rest, etc.)
    .filter((arg) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(arg));
}

export function getPropertiesWithMetadata(
  target: Constructor<unknown>,
): Record<string, Constructor<unknown> | null> {
  const types: Constructor<unknown>[] =
    Reflect.getMetadata('design:paramtypes', target) || [];

  const paramNames = getConstructorParamNames(target);

  const result: Record<string, Constructor<unknown> | null> = {};
  paramNames.forEach((name, i) => {
    result[name] = types[i] ?? null;
  });

  return result;
}

/** Narrows down a value to the primitive constructor set (String/Number/etc). */
export function isPrimitiveConstructor(
  value: unknown,
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

/** Builds an in-memory `Storage` mock and optionally exposes it on `globalThis`. */
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

export class DetailedError extends Error {
  [key: PropertyKey]: unknown;

  constructor(message: string, details?: Record<PropertyKey, unknown>) {
    super(message);
    if (details) {
      for (const key in details) {
        /* istanbul ignore next */
        if (!Object.prototype.hasOwnProperty.call(details, key)) continue;
        this[key] = details[key];
      }
    } else {
      this['details'] = null;
    }
  }
}

export function getGlobalOrThrow<T = unknown>(key: string): T {
  const value = (globalThis as any)[key];
  if (value == null) {
    throw new Error(`Global "${key}" is not available in this environment. Maybe you need a polyfill?`);
  }
  return value as T;
}
