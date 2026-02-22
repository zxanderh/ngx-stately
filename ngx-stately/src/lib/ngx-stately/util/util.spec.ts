import 'reflect-metadata';

import { Injector, runInInjectionContext, signal } from '@angular/core';

import {
  DetailedError,
  getPropertiesWithMetadata,
  isPrimitiveConstructor,
  isStorageVarSignal,
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

  it('extracts constructor metadata emitted by TypeScript', () => {
    function Noop(): ClassDecorator {
      return () => undefined;
    }

    @Noop()
    class Example {
      constructor(
        public breed: string = 'corgi',
        public dog: boolean = true,
      ) {}
    }

    const metadata = getPropertiesWithMetadata(Example);
    expect(metadata['breed']).toBe(String);
    expect(metadata['dog']).toBe(Boolean);
  });

  it('handles classes without constructors', () => {
    class NoConstructor {}

    const metadata = getPropertiesWithMetadata(NoConstructor);
    expect(metadata).toEqual({});
  });

  it('handles empty constructor parameter lists', () => {
    class EmptyConstructor {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      constructor() {}
    }

    const metadata = getPropertiesWithMetadata(EmptyConstructor);
    expect(metadata).toEqual({});
  });

  it('falls back to null when metadata is missing', () => {
    class NoMetadata {
      constructor(public name: string, public count: number) {}
    }

    const metadata = getPropertiesWithMetadata(NoMetadata);
    expect(metadata).toEqual({
      name: null,
      count: null,
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
});
