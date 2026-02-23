 
import { Injectable } from '@angular/core';
import { sessionVar } from 'ngx-stately';

@Injectable()
export class SessionStoreService {
  foo = sessionVar({ key: 'foo', default: 'bar' });
  token = sessionVar({ key: 'token', default: '' });
}
