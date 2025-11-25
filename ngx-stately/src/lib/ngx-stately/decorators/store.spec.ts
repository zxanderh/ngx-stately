import 'reflect-metadata';
import '../../../../testing/jest.helper';

import { TestBed } from '@angular/core/testing';

import { LocalStore, SessionStore } from './store';
import { provideStately } from '../service/stately.service';

const instantiate = <T>(factory: () => T): T => {
  return TestBed.runInInjectionContext(factory);
};

const createStorageMock = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
};

@SessionStore({
  providedIn: 'root',
  storeParams: true,
})
class Animal {
  constructor(
    public breed: string = 'corgi',
    public dog: boolean = true,
    public description?: string | null,
  ) {}
}

describe('SessionStore decorator', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });
    sessionStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('prefers persisted session values over constructor defaults', () => {
    sessionStorage.setItem('breed', JSON.stringify('husky'));
    sessionStorage.setItem('dog', JSON.stringify(false));

    const animal = instantiate(() => new Animal());

    expect(animal.breed).toBe('husky');
    expect(animal.dog).toBe(false);
  });

  it('lazily initializes unset properties on first access', () => {
    const animal = instantiate(() => new Animal(undefined, undefined, null));

    expect(animal.description).toBeNull();
  });

  it('persists signal updates immediately', () => {
    const animal = instantiate(() => new Animal('poodle', false));

    // First set creates the signal (skips persistence due to effect's firstCheck)
    animal.breed = 'shiba';
    // Flush effects to initialize (sets firstCheck = false)
    jest.runAllTimers();
    // Second set triggers persistence
    animal.breed = 'shiba-updated';
    jest.runAllTimers();

    expect(sessionStorage.getItem('breed')).toBe(JSON.stringify('shiba-updated'));
  });

  it('supports custom stores decorated inside tests', () => {
    class MutableValue {
      constructor(public value: string) {}

      static fromJSON(input: { value: string }) {
        return new MutableValue(input.value);
      }
    }

    @SessionStore({
      providedIn: 'root',
      storeParams: true,
    })
    class CustomStore {
      constructor(public complex: MutableValue = new MutableValue('default')) {}
    }

    sessionStorage.setItem(
      'complex',
      JSON.stringify({ value: 'from-storage' })
    );

    const store = instantiate(() => new CustomStore());

    expect(store.complex).toBeInstanceOf(MutableValue);
    expect(store.complex.value).toBe('from-storage');
  });

  it('persists signal changes without debounce', () => {
    @SessionStore({
      providedIn: 'root',
      storeParams: true,
    })
    class ImmediateStore {
      constructor(public breed: string = 'corgi') {}
    }

    const store = instantiate(() => new ImmediateStore());
    // First set creates signal (skips persistence)
    store.breed = 'samoyed';
    // Flush effects to initialize (sets firstCheck = false)
    jest.runAllTimers();
    // Second set triggers persistence immediately
    store.breed = 'samoyed-updated';
    jest.runAllTimers();

    expect(sessionStorage.getItem('breed')).toBe(JSON.stringify('samoyed-updated'));
  });

  it('skips parameter wiring when storeParams is disabled', () => {
    @SessionStore({
      providedIn: 'root',
      storeParams: false,
    })
    class PlainStore {
      constructor(public breed: string = 'corgi') {}
    }

    const store = instantiate(() => new PlainStore());
    store.breed = 'akita';

    jest.runAllTimers();
    expect(sessionStorage.getItem('breed')).toBeNull();
  });

  it('serializes complex objects by delegating to toJSON', () => {
    class Serializable {
      constructor(public value: string) {}

      toJSON() {
        return { value: this.value };
      }
    }

    @SessionStore({
      providedIn: 'root',
      storeParams: true,
    })
    class JsonStore {
      constructor(public complex: Serializable = new Serializable('alpha')) {}
    }

    const store = instantiate(() => new JsonStore());
    // First set creates signal (skips persistence)
    store.complex = new Serializable('beta');
    // Flush effects to initialize (sets firstCheck = false)
    jest.runAllTimers();
    // Second set triggers persistence
    store.complex = new Serializable('beta-updated');
    jest.runAllTimers();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(JSON.parse(sessionStorage.getItem('complex')!)).toEqual({
      value: 'beta-updated',
    });
  });
});

describe('LocalStore decorator', () => {
  let localStorageMock: Storage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStately()],
    });
    sessionStorage.clear();
    localStorageMock = createStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: localStorageMock,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('prefers persisted localStorage values when available', () => {
    localStorage.setItem('breed', JSON.stringify('shepherd'));
    localStorage.setItem('dog', JSON.stringify(false));

    @LocalStore({
      providedIn: 'root',
      storeParams: true,
    })
    class LocalAnimal {
      constructor(public breed: string = 'corgi', public dog: boolean = true) {}
    }

    const animal = instantiate(() => new LocalAnimal());

    expect(animal.breed).toBe('shepherd');
    expect(animal.dog).toBe(false);
    expect(sessionStorage.getItem('breed')).toBeNull();
  });

  it('persists updates back into localStorage', () => {
    @LocalStore({
      providedIn: 'root',
      storeParams: true,
    })
    class LocalAnimal {
      constructor(public breed: string = 'poodle') {}
    }

    const animal = instantiate(() => new LocalAnimal());

    // First set creates signal (skips persistence)
    animal.breed = 'akita';
    // Flush effects to initialize (sets firstCheck = false)
    jest.runAllTimers();
    // Second set triggers persistence
    animal.breed = 'akita-updated';
    jest.runAllTimers();

    expect(localStorage.getItem('breed')).toBe(JSON.stringify('akita-updated'));
  });

  it('falls back to sessionStorage when localStorage is unavailable', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    sessionStorage.setItem('breed', JSON.stringify('retriever'));

    @LocalStore({
      providedIn: 'root',
      storeParams: true,
    })
    class FallbackAnimal {
      constructor(public breed: string = 'corgi') {}
    }

    const animal = instantiate(() => new FallbackAnimal());

    expect(animal.breed).toBe('retriever');
  });
});
