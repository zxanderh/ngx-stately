import type { JestConfigWithTsJest } from 'ts-jest';

export default {
  displayName: 'ngx-stately',
  preset: '../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../coverage/ngx-stately',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
        diagnostics: {
          ignoreCodes: [151001],
        },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!lodash-es/.*|.*\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
  moduleNameMapper: {
    '^lodash-es$': '<rootDir>/testing/lodash-es',
  },
  coveragePathIgnorePatterns: [
    'storage.polyfill.ts',
    'jest.helper.ts',
  ],
} satisfies JestConfigWithTsJest;
