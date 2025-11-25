import { attempt, isError } from 'lodash-es';

describe('lodash-es compatibility shim', () => {
  it('returns the function result when no error is thrown', () => {
    const result = attempt(() => 'value');
    expect(result).toBe('value');
  });

  it('wraps thrown values and exposes an error guard', () => {
    const outcome = attempt(() => {
      throw 'bad';
    });

    expect(isError(outcome)).toBe(true);
    expect((outcome as Error).message).toContain('bad');
  });
});
