import 'reflect-metadata';
import '../../../../testing/storage.polyfill';

import { TestBed } from '@angular/core/testing';
import { inject } from '@angular/core';

import { storageVar, generateStorageVarCreator, sessionVar, localVar } from './var';
import { DefaultStatelyService, StatelyService, provideStately } from '../service/stately.service';
import { DetailedError, lazyRef, mockStorage, StorageVarSignal } from '../util/util';

const instantiate = <T>(factory: () => T): T => {
  return TestBed.runInInjectionContext(factory);
};

describe('storageVar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });
    sessionStorage.clear();
    localStorage.clear();
  });

  it('bootstraps the signal from persisted storage values', () => {
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

  it('coerces primitives using constructor, if needed', () => {
    const spy = jest.spyOn(Number.prototype, 'constructor' as any);
    try {
      // simulate numeric value mistakenly stored as string
      sessionStorage.setItem('qty', JSON.stringify('9'));

      const signal$ = instantiate(() =>
        storageVar<number>({
          key: 'qty',
          storage: sessionStorage,
          default: 0,
        }),
      );

      expect(signal$()).toBe(9);
      expect(spy).toHaveBeenCalledWith('9');
    } finally {
      spy.mockRestore();
    }
  });

  it('reuses existing signals tracked by StatelyService', () => {
    let trackedSignal: StorageVarSignal<string | undefined>;

    const signal$ = instantiate(() => {
      const service = inject(StatelyService) as DefaultStatelyService;
      service.session.set('shared-key', 'existing');

      trackedSignal = service.signals['session']['shared-key'] as StorageVarSignal<string | undefined>;

      return storageVar<string>({
        key: 'shared-key',
        storage: sessionStorage,
      });
    });

    expect(signal$).toBe(trackedSignal!);
    expect(signal$()).toBe('existing');
  });

  it('throws a DetailedError when storage is not registered with StatelyService', () => {
    const customStorage = mockStorage('custom-storage');

    expect(() =>
      instantiate(() =>
        storageVar({
          key: 'unregistered',
          storage: customStorage,
        }),
      ),
    ).toThrow(DetailedError);
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
    jest.spyOn(lazyStorage, 'value');

    const createLocalVar = generateStorageVarCreator(lazyStorage);

    const signal$ = instantiate(() =>
      createLocalVar<string>({
        key: 'lazy-key',
      }),
    );

    expect(lazyStorage.value).toHaveBeenCalledTimes(1);
    expect(signal$()).toBe('lazy-value');
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
