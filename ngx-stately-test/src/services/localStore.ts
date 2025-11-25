/* eslint-disable @typescript-eslint/no-inferrable-types */
import { Injectable } from '@angular/core';
import { localVar } from 'ngx-stately';

@Injectable()
export class LocalStoreService {
  color = localVar({ key: 'color', default: '#eee' });
}
