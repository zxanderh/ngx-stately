import 'reflect-metadata';

import { deserialize, serialize } from './serialization';

describe('serialization helpers', () => {
  it('parses JSON strings and coerces primitive constructors when needed', () => {
    const numberCtor = Number as unknown as { new (): number };
    const stringCtor = String as unknown as { new (): string };

    const numberResult = deserialize<number>('"123"', numberCtor, 'num');
    expect(numberResult).toBe(123);

    const stringResult = deserialize<string>('"abc"', stringCtor, 'str');
    expect(stringResult).toBe('abc');
  });

  it('hydrates complex objects via fromJSON or prototype reassignment', () => {
    class Complex {
      constructor(public value: string = '') {}

      static fromJSON(input: { value: string }) {
        return new Complex(input.value);
      }
    }

    class Plain {
      value?: string;
    }

    const complex = deserialize<Complex>(
      JSON.stringify({ value: 'from-json' }),
      Complex,
      'complex',
    );
    expect(complex).toBeInstanceOf(Complex);
    expect(complex.value).toBe('from-json');

    const plain = deserialize<Plain>(
      JSON.stringify({ value: 'proto' }),
      Plain,
      'plain',
    );
    expect(Object.getPrototypeOf(plain)).toBe(Plain);
    expect(plain.value).toBe('proto');
  });

  it('skips prototype reassignment when already aligned', () => {
    class Aligned {
      value?: string;
    }

    const value = { value: 'ready' };
    Object.setPrototypeOf(value, Aligned);

    const result = deserialize<Aligned>(value, Aligned, 'aligned');
    expect(Object.getPrototypeOf(result)).toBe(Aligned);
    expect(result.value).toBe('ready');
  });

  it('logs parse errors but still returns the original value', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const value = deserialize('not-json', null, 'bad');
    expect(value).toBe('not-json');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('serializes plain values and defers to toJSON when present', () => {
    class Custom {
      constructor(public value: string) {}

      toJSON() {
        return { custom: this.value };
      }
    }

    const plain = serialize('hello');
    expect(plain).toBe(JSON.stringify('hello'));

    const custom = serialize(new Custom('world'));
    expect(custom).toBe(JSON.stringify({ custom: 'world' }));
  });

  it('passes through already parsed values without attempting to JSON parse', () => {
    const raw = { nested: true };
    expect(deserialize(raw, null, 'raw')).toBe(raw);
  });
});
