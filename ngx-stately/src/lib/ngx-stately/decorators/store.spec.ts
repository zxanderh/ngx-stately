import 'reflect-metadata';

import { TestBed } from '@angular/core/testing';

import { LocalStore, SessionStore } from './store';

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
  constructor(public breed: string = 'corgi', public dog: boolean = true) {}
}

describe('SessionStore decorator', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
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

  it('persists signal updates after the debounce window', () => {
    const animal = instantiate(() => new Animal('poodle', false));

    animal.breed = 'shiba';

    jest.advanceTimersByTime(600);

    expect(sessionStorage.getItem('breed')).toBe(JSON.stringify('shiba'));
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
});

describe('LocalStore decorator', () => {
  let localStorageMock: Storage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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

    animal.breed = 'akita';

    jest.advanceTimersByTime(600);

    expect(localStorage.getItem('breed')).toBe(JSON.stringify('akita'));
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
