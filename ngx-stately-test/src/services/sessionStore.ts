/* eslint-disable @typescript-eslint/no-inferrable-types */
import { SessionStore } from 'ngx-stately';

@SessionStore({
  providedIn: 'root',
})
export class SessionStoreService {
  constructor(
    public foo: string = 'bar',
  ) {}
}
