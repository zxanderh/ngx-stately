/* eslint-disable @typescript-eslint/no-inferrable-types */
import { SessionStore, Store } from 'ngx-stately';

@Store
export class SessionStoreService extends SessionStore {
  constructor(
    public foo: string = 'bar',
    public token: string,
  ) { super(); }
}
