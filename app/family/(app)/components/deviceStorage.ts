/**
 * The two things every per-device store does with `localStorage`, written
 * once: read one JSON value and write one back. Shared by `useDeviceSwitches`
 * (the boolean switch stores) and `useWeekCelebrations`' shown-keys memory, so
 * the try/catch discipline of constitution §VI — storage may be absent,
 * refused or corrupt, and the app carries on in memory — lives in one place.
 *
 * `readDeviceJson` THROWS when storage refuses or the value is not JSON; the
 * caller decides what a failed read means for it (the switches say "won't be
 * remembered", the celebrations say "nothing is provably shown").
 * `writeDeviceJson` answers whether the write took, for the same reason.
 */

/** The stored value, `undefined` when nothing is stored; throws when refused or corrupt. */
export function readDeviceJson(key: string): unknown {
  const raw = window.localStorage.getItem(key);
  return raw === null ? undefined : (JSON.parse(raw) as unknown);
}

/** Writes; false when storage refused, so the caller can say the choice won't be remembered. */
export function writeDeviceJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** A store's subscribers: `add` returns the unsubscribe, `emit` tells everyone. */
export interface DeviceListeners {
  add: (listener: () => void) => () => void;
  emit: () => void;
}

export function createDeviceListeners(): DeviceListeners {
  const listeners = new Set<() => void>();
  return {
    add(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit() {
      for (const listener of listeners) listener();
    },
  };
}
