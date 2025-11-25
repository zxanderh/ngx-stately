import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Base } from './base';

@Component({
  imports: [Base, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'ngx-stately';
}
