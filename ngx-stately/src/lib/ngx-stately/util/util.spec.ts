import 'reflect-metadata';

import { Injector, runInInjectionContext, signal } from '@angular/core';

import {
  DetailedError,
  getGlobalOrThrow,
  isLazyRef,
  isPrimitiveConstructor,
  isStorageVarSignal,
  lazyRef,
  MultiKeyMap,
  mockStorage,
  STATELY_OPTIONS,
} from './util';
import { storageVar } from '../signals/var';
import { TestBed } from '@angular/core/testing';
import { provideStately } from '../service/stately.service';

describe('utility helpers', () => {
  let injector: Injector;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });
    injector = TestBed.inject(Injector);
  });

  it('detects storage-backed signals', () => {
    runInInjectionContext(injector, () => {
      const statelySignal = storageVar({
        key: 'tracked',
        default: 'value',
        storage: sessionStorage,
      });

      expect(isStorageVarSignal(statelySignal)).toBe(true);
      expect(isStorageVarSignal(signal('plain'))).toBe(false);
      expect(statelySignal[STATELY_OPTIONS].key).toBe('tracked');
    });
  });

  it('detects primitive constructors', () => {
    expect(isPrimitiveConstructor(String)).toBe(true);
    expect(isPrimitiveConstructor(Number)).toBe(true);
    expect(isPrimitiveConstructor(Boolean)).toBe(true);
    expect(isPrimitiveConstructor(Symbol)).toBe(true);
    expect(isPrimitiveConstructor(class Custom {})).toBe(false);
    expect(isPrimitiveConstructor(null)).toBe(false);
  });

  it('sets DetailedError details to null when omitted', () => {
    const error = new DetailedError('boom');
    expect((error as { details?: unknown }).details).toBeNull();
  });

  it('creates isolated in-memory storage mocks', () => {
    const storage = mockStorage('namedStorage', true);
    storage.setItem('key', 'value');
    expect(storage.getItem('key')).toBe('value');

    storage.removeItem('key');
    expect(storage.getItem('key')).toBeNull();

    storage.setItem('foo', 'bar');
    storage.clear();
    expect(storage.length).toBe(0);
    storage.setItem('first', '1');
    storage.setItem('second', '2');
    expect(storage.key(0)).toBe('first');

    expect((globalThis as Record<string, unknown>)['namedStorage']).toBe(
      storage,
    );
  });

  it('keeps storages isolated by instance', () => {
    const a = mockStorage('storageA', false);
    const b = mockStorage('storageB', false);

    a.setItem('shared-key', 'a-value');
    b.setItem('shared-key', 'b-value');

    expect(a.getItem('shared-key')).toBe('a-value');
    expect(b.getItem('shared-key')).toBe('b-value');
  });

  it('coerces non-string values to strings in setItem', () => {
    const storage = mockStorage('coercionStorage', false);

    storage.setItem('n', 42 as unknown as string);
    storage.setItem('b', false as unknown as string);

    expect(storage.getItem('n')).toBe('42');
    expect(storage.getItem('b')).toBe('false');
  });

  it('does not expose the storage globally when globalize is false', () => {
    const globalKey = 'nonGlobalStorage';
    const globals = globalThis as Record<string, unknown>;
    const existingValue = globals[globalKey];

    const storage = mockStorage(globalKey, false);
    expect(storage).toBeDefined();
    expect(globals[globalKey]).toBe(existingValue);
  });

  it('defines a non-enumerable, non-configurable storage name property', () => {
    const storage = mockStorage('describedStorage', false);
    const descriptor = Object.getOwnPropertyDescriptor(storage, 'name');

    expect((storage as Record<string, unknown>)['name']).toBe('describedStorage');
    expect(descriptor?.enumerable).toBe(false);
    expect(descriptor?.configurable).toBe(false);
    expect(descriptor?.writable).toBe(false);
  });

  it('creates a lazy reference that defers factory execution', () => {
    const factory = jest.fn().mockImplementation(() => sessionStorage);
    const ref = lazyRef(factory);

    expect(factory).not.toHaveBeenCalled();
    expect(isLazyRef(ref)).toBe(true);
    expect(ref.value()).toBe(sessionStorage);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('isLazyRef returns false for nullish values', () => {
    expect(isLazyRef(null)).toBe(false);
    expect(isLazyRef(undefined)).toBe(false);
  });

  it('isLazyRef returns false for lookalike objects without the lazy marker', () => {
    expect(isLazyRef({ value: () => sessionStorage })).toBe(false);
  });
});

describe('getGlobalOrThrow', () => {
  let ogSnStorage: Storage;
  beforeEach(() => {
    ogSnStorage = globalThis.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', { value: null });
  });
  afterEach(() => {
    Object.defineProperty(window, 'sessionStorage', { value: ogSnStorage });
  });

  it('getGlobalOrThrow: throws if not present', () => {
    expect(() => getGlobalOrThrow('sessionStorage')).toThrow(/not available/);
  });
});

describe('MultiKeyMap', () => {
  it('sets values, reads values, and tracks size without double-counting overwrites', () => {
    const map = new MultiKeyMap<string, string, number>();

    map.set('local', 'theme', 1);
    map.set('local', 'theme', 2); // overwrite same entry
    map.set('local', 'lang', 3);

    expect(map.size).toBe(2);
    expect(map.get('local', 'theme')).toBe(2);
    expect(map.get('local', 'lang')).toBe(3);
    expect(map.get('missing', 'entry')).toBeUndefined();
    expect(map.has('local', 'theme')).toBe(true);
    expect(map.has('missing', 'entry')).toBe(false);
  });

  it('deletes entries and prunes empty first-level keys', () => {
    const map = new MultiKeyMap<string, string, string>();

    map.set('session', 'token', 'abc');
    map.set('session', 'user', 'zane');

    expect(map.delete('session', 'token')).toBe(true);
    expect(map.size).toBe(1);
    expect(map.has('session', 'token')).toBe(false);
    expect(map.has('session', 'user')).toBe(true);

    expect(map.delete('session', 'user')).toBe(true); // removes now-empty inner map
    expect(map.size).toBe(0);
    expect(map.has('session', 'user')).toBe(false);
    expect(map.get('session', 'user')).toBeUndefined();
  });

  it('returns false when deleting missing keys', () => {
    const map = new MultiKeyMap<string, string, number>();
    map.set('k1', 'k2', 1);

    expect(map.delete('missing', 'k2')).toBe(false);
    expect(map.delete('k1', 'missing')).toBe(false);
    expect(map.size).toBe(1);
  });

  it('iterates entries, keys, and values across all buckets', () => {
    const map = new MultiKeyMap<string, string, string>();
    map.set('local', 'a', 'A');
    map.set('local', 'b', 'B');
    map.set('session', 'c', 'C');

    expect([ ...map.entries() ]).toEqual([
      ['local', 'a', 'A'],
      ['local', 'b', 'B'],
      ['session', 'c', 'C'],
    ]);

    expect([ ...map.keys() ]).toEqual([
      ['local', 'a'],
      ['local', 'b'],
      ['session', 'c'],
    ]);

    expect([ ...map.values() ]).toEqual(['A', 'B', 'C']);
  });

  it('clears all data and resets size', () => {
    const map = new MultiKeyMap<string, string, string>();
    map.set('one', 'a', 'A');
    map.set('two', 'b', 'B');

    map.clear();

    expect(map.size).toBe(0);
    expect([ ...map.entries() ]).toEqual([]);
    expect([ ...map.keys() ]).toEqual([]);
    expect([ ...map.values() ]).toEqual([]);
  });
});
