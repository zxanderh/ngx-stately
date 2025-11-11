import { Injectable } from "@angular/core";
import { AbstractStore } from "./abstract";

@Injectable()
export class LocalStore extends AbstractStore {
  storage = localStorage;
}

@Injectable()
export class SessionStore extends AbstractStore {
  storage = sessionStorage;
}

export { AbstractStore };
