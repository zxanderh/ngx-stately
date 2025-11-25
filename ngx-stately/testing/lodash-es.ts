export function attempt<T>(func: (...args: unknown[]) => T, ...args: unknown[]): T | Error {
  try {
    return func(...args);
  } catch (error) {
    /* istanbul ignore next */
    return error instanceof Error ? error : new Error(String(error));
  }
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
