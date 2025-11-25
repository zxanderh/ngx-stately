import { inspect as utilInspect } from 'node:util';

export function inspect(strings: TemplateStringsArray, ...values: unknown[]) {
  let result = '';
  strings.forEach((str, i) => {
    result += str;
    if (i < values.length) {
      result += utilInspect(values[i], {
        colors: true,
        depth: 2,
        maxArrayLength: 5,
      });
    }
  });
  return result;
}

export const matchers = {
  toBeNullish: (received: unknown) => {
    const pass = received == null;
    if (pass) {
      return {
        message: () => inspect`expected ${received} to not be nullish`,
        pass: true,
      };
    } else {
      return {
        message: () => inspect`expected ${received} to be nullish`,
        pass: false,
      };
    }
  },
};
if (typeof expect !== 'undefined') {
  expect.extend(matchers);
}

// Source - https://stackoverflow.com/a/60229956
// Posted by Joshua T, modified by community. See post 'Timeline' for change history
// Retrieved 2025-11-19, License - CC BY-SA 4.0

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      toBeNullish(): CustomMatcherResult;
    }
  }
}

