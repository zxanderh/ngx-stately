import { CreateSignalOptions, isSignal, signal, WritableSignal } from '@angular/core';

/** Internal symbol used to stash storage metadata on signals. */
export const STATELY_OPTIONS = Symbol('STATELY_OPTIONS');

export interface StorageVarOptions<T> extends CreateSignalOptions<T> {
  default?: T;
  key: string;
  initialized?: boolean;
  storage?: Storage;
}

export interface StandaloneStorageVarOptions<T> extends StorageVarOptions<T> {
  storage: Storage;
}

export type StorageVarRootValue<T> = { value: T; source: string };

/** Writable signal augmented with storage metadata so stores can bootstrap it. */
export type StorageVarSignal<T> = WritableSignal<T> & { [STATELY_OPTIONS]: StorageVarOptions<T> };

export type StorageVarRootSignal<T> = WritableSignal<StorageVarRootValue<T>> & { [STATELY_OPTIONS]: StorageVarOptions<T> & { root: true } };

/** Type guard that checks if a value is a storage-aware signal produced by ngx-stately. */
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
    value === ('').constructor ||
    value === (0).constructor ||
    value === (false).constructor ||
    value === STATELY_OPTIONS.constructor
  );
}

/** Builds an in-memory `Storage` mock and optionally exposes it on `globalThis`. */
export function mockStorage(name: string, globalize: boolean) {
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

/** An error with additional details attached. */
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
      /* istanbul ignore next */
      this['details'] = null;
    }
  }
}

/**
 * Retrieves the global value if present. Otherwise, throws a descriptive error.
 *
 * @param key The key to retrieve from the global object.
 * @returns The value from the global object, if present.
 */
export function getGlobalOrThrow<T = unknown>(key: string): T {
  const value = (globalThis as any)[key];
  if (value == null) {
    throw new Error(`Global "${key}" is not available in this environment. Maybe you need a polyfill?`);
  }
  return value as T;
}

/** Unique symbol identifying LazyRef */
const LAZY_REF = Symbol('LAZY_REF');

/** A wrapper object containing a lazy evaluation function. */
export interface LazyRef<T> {
  [LAZY_REF]: true;
  value: () => T;
}

/** Type guard for LazyRef. */
export function isLazyRef(value: unknown): value is LazyRef<any> {
  return (value as LazyRef<any>)?.[LAZY_REF] === true;
}

/**
 * A function wrapper that allows a value to be lazily evaluated. Functionally based
 * on Angular's forwardRef, though it serves a different purpose. This is primarily used
 * with generateStorageVarCreator to bind to sessionStorage and localStorage even in
 * environments that don't have them, avoiding throwing an error until localVar/sessionVar
 * are actually called.
 *
 * @param fn function that returns the target value
 * @returns the LazyRef instance
 */
export function lazyRef<T>(fn: () => T) {
  return {
    [LAZY_REF]: true,
    value: fn,
  } as LazyRef<T>;
}

export class MultiKeyMap<K1, K2, V> {
  private root = new Map<K1, Map<K2, V>>();
  private _size = 0;

  set(k1: K1, k2: K2, value: V): this {
    let inner = this.root.get(k1);

    if (!inner) {
      inner = new Map<K2, V>();
      this.root.set(k1, inner);
    }

    if (!inner.has(k2)) {
      this._size++;
    }

    inner.set(k2, value);
    return this;
  }

  get(k1: K1, k2: K2): V | undefined {
    return this.root.get(k1)?.get(k2);
  }

  has(k1: K1, k2: K2): boolean {
    return this.root.get(k1)?.has(k2) ?? false;
  }

  delete(k1: K1, k2: K2): boolean {
    const inner = this.root.get(k1);
    if (!inner) return false;

    const deleted = inner.delete(k2);

    if (deleted) {
      this._size--;

      if (inner.size === 0) {
        this.root.delete(k1);
      }
    }

    return deleted;
  }

  clear(): void {
    this.root.clear();
    this._size = 0;
  }

  get size(): number {
    return this._size;
  }

  *entries(): IterableIterator<readonly [K1, K2, V]> {
    for (const [k1, inner] of this.root) {
      for (const [k2, value] of inner) {
        yield [k1, k2, value] as const;
      }
    }
  }

  *keys(): IterableIterator<readonly [K1, K2]> {
    for (const [k1, inner] of this.root) {
      for (const k2 of inner.keys()) {
        yield [k1, k2] as const;
      }
    }
  }

  *values(): IterableIterator<V> {
    for (const inner of this.root.values()) {
      yield* inner.values();
    }
  }
}

