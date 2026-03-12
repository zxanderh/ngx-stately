import 'reflect-metadata';
import '../../../../testing/storage.polyfill';

import { TestBed } from '@angular/core/testing';
import { inject } from '@angular/core';

import { provideStately, StatelyService } from './stately.service';
import { DetailedError } from '../util/util';

const instantiate = <T>(factory: () => T): T => TestBed.runInInjectionContext(factory);

describe('StatelyService', () => {
  let service: StatelyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });

    sessionStorage.clear();
    localStorage.clear();

    service = instantiate(() => inject(StatelyService));
  });

  it('is provided by provideStately()', () => {
    expect(service).toBeInstanceOf(StatelyService);
  });

  it('requires an injection context for createLinked()', () => {
    expect(() =>
      service.createLinked<string>({
        key: 'outside-context',
        storage: sessionStorage,
      }),
    ).toThrow();
  });

  it('throws DetailedError when options.storage is missing', () => {
    expect(() =>
      instantiate(() =>
        service.createLinked<string>({
          key: 'missing-storage',
          storage: undefined as unknown as Storage,
        }),
      ),
    ).toThrow(DetailedError);
  });

  it('bootstraps linked signals from stored values', () => {
    sessionStorage.setItem('breed', JSON.stringify('husky'));

    const signal$ = instantiate(() =>
      service.createLinked<string>({
        key: 'breed',
        storage: sessionStorage,
      }),
    );

    expect(signal$()).toBe('husky');
  });

  it('keeps default-only values in memory until a write occurs', () => {
    instantiate(() =>
      service.createLinked<string>({
        key: 'default-only',
        storage: sessionStorage,
        default: 'fallback',
      }),
    );

    TestBed.tick();
    expect(sessionStorage.getItem('default-only')).toBeNull();
  });

  it('shares one root signal for linked signals using the same storage key', () => {
    const [first, second] = instantiate(() => {
      const one = service.createLinked<string>({
        key: 'shared',
        storage: sessionStorage,
      });
      const two = service.createLinked<string>({
        key: 'shared',
        storage: sessionStorage,
      });
      return [one, two] as const;
    });

    expect(first).not.toBe(second);
    expect(service.rootSignals.size).toBe(1);

    first.set('updated');
    TestBed.tick();

    expect(second()).toBe('updated');
  });

  it('writes linked signal updates back to storage', () => {
    const signal$ = instantiate(() =>
      service.createLinked<string>({
        key: 'persisted',
        storage: sessionStorage,
      }),
    );

    signal$.set('value-from-signal');
    TestBed.tick();

    expect(sessionStorage.getItem('persisted')).toBe(
      JSON.stringify('value-from-signal'),
    );
  });

  it('applies ctor deserialization when provided through options', () => {
    sessionStorage.setItem('qty', JSON.stringify('9'));

    const signal$ = instantiate(() =>
      service.createLinked<number>({
        key: 'qty',
        storage: sessionStorage,
        // ctor is consumed by getOrCreateRootSignal but is not part of public options typing yet.
        ctor: Number,
      } as any),
    );

    expect(signal$()).toBe(9);
  });

  it('isolates roots by storage implementation for the same key', () => {
    const [sessionSignal, localSignal] = instantiate(() => {
      const one = service.createLinked<string>({
        key: 'same-key',
        storage: sessionStorage,
      });
      const two = service.createLinked<string>({
        key: 'same-key',
        storage: localStorage,
      });
      return [one, two] as const;
    });

    sessionSignal.set('session-only');
    localSignal.set('local-only');
    TestBed.tick();

    expect(service.rootSignals.size).toBe(2);
    expect(sessionStorage.getItem('same-key')).toBe(JSON.stringify('session-only'));
    expect(localStorage.getItem('same-key')).toBe(JSON.stringify('local-only'));
  });
});
