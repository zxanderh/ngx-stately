import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalStoreService } from '../services/localStore';
import { SessionStoreService } from '../services/sessionStore';
import { localVar } from 'ngx-stately';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-base',
  imports: [CommonModule, FormsModule],
  template: `
  <div class="d-block" style="width: 25rem;">
    <div class="m-3">
      <label for="color" class="form-label">Color</label>
      <input type="color" name="color" id="color" class="form-control" [(ngModel)]="localStore.color">
    </div>
    <div class="m-3">
      <label for="token" class="form-label">Token</label>
      <input type="text" name="token" id="token" class="form-control" [(ngModel)]="sessionStore.token">
    </div>
    <div class="form-check form-switch m-3">
      <input class="form-check-input" type="checkbox" id="bool" [(ngModel)]="bool">
      <label class="form-check-label" for="bool">@if(bool()){Yeah!}@else{Nah}</label>
    </div>
  </div>
  `,
  styles: ``,
})
export class Base {
  localStore = inject(LocalStoreService);
  sessionStore = inject(SessionStoreService);
  bool = localVar({ key: 'bool', default: false });
}
