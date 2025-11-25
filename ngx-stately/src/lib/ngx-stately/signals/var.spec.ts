import 'reflect-metadata';
import '../../../../testing/storage.polyfill';

import { TestBed } from '@angular/core/testing';
import { inject } from '@angular/core';

import { storageVar, generateStorageVarCreator, sessionVar, localVar } from './var';
import { StatelyService, provideStately } from '../service/stately.service';
import { DetailedError, mockStorage, StorageVarSignal } from '../util/util';

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

  it('reuses existing signals tracked by StatelyService', () => {
    let trackedSignal: StorageVarSignal<string | undefined>;

    const signal$ = instantiate(() => {
      const service = inject(StatelyService);
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
