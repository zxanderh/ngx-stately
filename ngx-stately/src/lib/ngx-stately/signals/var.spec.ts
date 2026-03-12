import 'reflect-metadata';
import '../../../../testing/storage.polyfill';

import { TestBed } from '@angular/core/testing';
import { inject } from '@angular/core';

import { generateStorageVarCreator, localVar, sessionVar, storageVar } from './var';
import { provideStately, StatelyService } from '../service/stately.service';
import { lazyRef, mockStorage } from '../util/util';

const instantiate = <T>(factory: () => T): T => TestBed.runInInjectionContext(factory);

describe('storageVar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });
    sessionStorage.clear();
    localStorage.clear();
  });

  it('delegates to StatelyService.createLinked()', () => {
    const spy = jest.spyOn(StatelyService.prototype, 'createLinked');

    instantiate(() =>
      storageVar<string>({
        key: 'delegated',
        storage: sessionStorage,
        default: 'value',
      }),
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'delegated',
        storage: sessionStorage,
        default: 'value',
      }),
    );
    spy.mockRestore();
  });

  it('bootstraps values from storage', () => {
    sessionStorage.setItem('breed', JSON.stringify('husky'));

    const signal$ = instantiate(() =>
      storageVar<string>({
        key: 'breed',
        storage: sessionStorage,
      }),
    );

    expect(signal$()).toBe('husky');
  });

  it('uses provided defaults when storage is empty', () => {
    const signal$ = instantiate(() =>
      storageVar<string>({
        key: 'missing-key',
        storage: sessionStorage,
        default: 'fallback',
      }),
    );

    expect(signal$()).toBe('fallback');
  });

  it('infers ctor from default values during deserialization', () => {
    // Simulate an older payload where a numeric value was stored as a JSON string.
    sessionStorage.setItem('qty', JSON.stringify('9'));

    const signal$ = instantiate(() =>
      storageVar<number>({
        key: 'qty',
        storage: sessionStorage,
        default: 0,
      }),
    );

    expect(typeof signal$()).toBe('number');
    expect(signal$()).toBe(9);
  });

  it('respects custom equality comparators from signal options', () => {
    const signal$ = instantiate(() =>
      storageVar<{ id: number; label: string }>({
        key: 'equal-key',
        storage: sessionStorage,
        default: { id: 1, label: 'initial' },
        equal: (a, b) => a?.id === b?.id,
      }),
    );

    signal$.set({ id: 1, label: 'updated-but-equal' });
    TestBed.tick();

    expect(signal$()).toEqual({ id: 1, label: 'initial' });
    expect(sessionStorage.getItem('equal-key')).toBeNull();
  });

  it('shares updates across linked signals for the same storage key', () => {
    const [first, second, service] = instantiate(() => {
      const one = storageVar<string>({
        key: 'shared-key',
        storage: sessionStorage,
      });
      const two = storageVar<string>({
        key: 'shared-key',
        storage: sessionStorage,
      });
      return [one, two, inject(StatelyService)] as const;
    });

    first.set('updated');
    TestBed.tick();

    expect(first).not.toBe(second);
    expect(second()).toBe('updated');
    expect(service.rootSignals.size).toBe(1);
  });

  it('supports any Storage implementation without registration', () => {
    const customStorage = mockStorage('custom-storage', false);

    const signal$ = instantiate(() =>
      storageVar<string>({
        key: 'custom-key',
        storage: customStorage,
        default: 'initial',
      }),
    );

    signal$.set('custom-updated');
    TestBed.tick();

    expect(signal$()).toBe('custom-updated');
    expect(customStorage.getItem('custom-key')).toBe(
      JSON.stringify('custom-updated'),
    );
  });
});

describe('generateStorageVarCreator', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });
    sessionStorage.clear();
    localStorage.clear();
  });

  it('binds the provided storage for future storageVar calls', () => {
    const createSessionVar = generateStorageVarCreator(sessionStorage);

    const signal$ = instantiate(() =>
      createSessionVar<string>({
        key: 'locked',
        default: 'from-default',
      }),
    );

    expect(signal$()).toBe('from-default');
  });

  it('resolves lazyRef storage when creating a signal', () => {
    sessionStorage.setItem('lazy-key', JSON.stringify('lazy-value'));

    const lazyStorage = lazyRef(() => sessionStorage);
    const lazySpy = jest.spyOn(lazyStorage, 'value');

    const createSessionVar = generateStorageVarCreator(lazyStorage);
    const signal$ = instantiate(() =>
      createSessionVar<string>({
        key: 'lazy-key',
      }),
    );

    expect(lazySpy).toHaveBeenCalledTimes(1);
    expect(signal$()).toBe('lazy-value');

    lazySpy.mockRestore();
  });
});

describe('sessionVar and localVar helpers', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sessionVar preconfigures storageVar with sessionStorage', () => {
    sessionStorage.setItem('session-key', JSON.stringify('persisted'));

    const signal$ = instantiate(() =>
      sessionVar<string>({
        key: 'session-key',
      }),
    );

    expect(signal$()).toBe('persisted');
  });

  it('localVar preconfigures storageVar with localStorage', () => {
    localStorage.setItem('local-key', JSON.stringify('saved-local'));

    const signal$ = instantiate(() =>
      localVar<string>({
        key: 'local-key',
      }),
    );

    expect(signal$()).toBe('saved-local');
  });
});
