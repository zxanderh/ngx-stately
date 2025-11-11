import { Injectable } from '@angular/core';
import { isStorageVarSignal, STATELY_OPTIONS } from '../util/util';
import { attachToSignal, StandaloneStorageVarOptions } from '../signals/var';

@Injectable()
export abstract class AbstractStore {
  abstract storage: Storage;

  constructor() {
    for (const key in this) {
      const val = this[key];
      if (isStorageVarSignal(val)) {
        const options = val[STATELY_OPTIONS];
        if (!options.initialized) {
          (options as StandaloneStorageVarOptions<unknown>).storage = this['storage'];
          attachToSignal(val, options);
        }
      }
    }
  }
}
