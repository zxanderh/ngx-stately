import { isPrimitiveConstructor } from './util';

// ToDo: configurable (de)serialization
/** Rehydrates a stored value using optional constructors/JSON helpers while handling primitives. */
export function deserialize<T>(value: unknown, constr: { new (): T } | null, key: string): T {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (e) {
      console.error(
        `Error parsing stored value (key: ${key}, value: ${value})`,
        e,
      );
    }
  }
  if (constr != null) {
    if (
      isPrimitiveConstructor(constr) &&
      typeof value != constr.name.toLowerCase()
    ) {
      value = constr(value);
    } else if ('fromJSON' in constr && typeof constr.fromJSON === 'function') {
      value = constr.fromJSON(value);
    } else if (Object.getPrototypeOf(value) !== constr) {
      Object.setPrototypeOf(value, constr);
    }
  }
  return value as T;
}

// ToDo: improve serialization
/** Serialises a value, delegating to `toJSON` implementations when available. */
export function serialize<T>(value: T) {
  let val: unknown = value;
  if (
    value &&
    typeof value === 'object' &&
    'toJSON' in value &&
    typeof value.toJSON === 'function'
  ) {
    val = value.toJSON();
  }
  return JSON.stringify(val);
}
