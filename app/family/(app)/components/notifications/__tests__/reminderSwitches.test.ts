import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetReminderSwitches, useReminderSwitches } from "../reminderSwitches";

/**
 * 008 T025 — this device's two reminder choices (FR-815).
 *
 * The household decides in Settings what it wants reminding of; these two
 * switches are the separate question of what THIS screen does about it. Banner
 * is on, because a household that turned reminders on expects to see them and a
 * quiet device is the exception. Chime is OFF, and that default is the point of
 * this file rather than an incidental: Phase 1 chose a silent display, the
 * reference's sound toggle is one unselectable tone, and shipping the switch is
 * not licence to overturn the silence by default.
 *
 * Neither switch asks a browser for anything. A banner is a DOM element on a
 * page somebody has open — there is no system notification, no service worker
 * and no Web Push left in this phase — so there is no permission to request and
 * nothing to be refused. The suite says so out loud below, because the same two
 * words meant something very different while push was still in scope.
 *
 * Constitution §VI is the most valuable half of the file: storage may be
 * absent, refused, or hold something corrupt from an older build, and every one
 * of those degrades to the defaults working in memory with `persistent` false.
 * A wall tablet must never white-screen over a preference.
 */

const STORAGE_KEY = "family:reminder-switches:v1";

beforeEach(() => {
  localStorage.clear();
  // The store is module-level, so one test's chime would be the next one's.
  resetReminderSwitches();
});

describe("the two switches a device gets", () => {
  it("shows banners by default, so reminders the household asked for arrive", () => {
    const { result } = renderHook(() => useReminderSwitches());

    expect(result.current.switches.banner).toBe(true);
    expect(result.current.persistent).toBe(true);
  });

  it("leaves the chime OFF by default, keeping Phase 1's silent display", () => {
    const { result } = renderHook(() => useReminderSwitches());

    expect(result.current.switches).toEqual({ banner: true, chime: false });
  });

  it("turns the chime on when somebody asks for a sound, and reads back on", () => {
    const { result } = renderHook(() => useReminderSwitches());

    act(() => result.current.setSwitch("chime", true));

    expect(result.current.switches.chime).toBe(true);
  });

  it("silences a device without silencing its chime setting", () => {
    const { result } = renderHook(() => useReminderSwitches());

    act(() => result.current.setSwitch("chime", true));
    act(() => result.current.setSwitch("banner", false));

    expect(result.current.switches).toEqual({ banner: false, chime: true });
  });

  it("turns a switch back off again", () => {
    const { result } = renderHook(() => useReminderSwitches());

    act(() => result.current.setSwitch("chime", true));
    act(() => result.current.setSwitch("chime", false));

    expect(result.current.switches.chime).toBe(false);
  });

  it("keeps the snapshot's identity when a switch is set to what it already was", () => {
    const { result } = renderHook(() => useReminderSwitches());
    const first = result.current.switches;

    act(() => result.current.setSwitch("banner", true));

    expect(result.current.switches).toBe(first);
  });

  it("hands a NEW object out on a real change, so the banner below it re-reads", () => {
    const { result } = renderHook(() => useReminderSwitches());
    const first = result.current.switches;

    act(() => result.current.setSwitch("chime", true));

    expect(result.current.switches).not.toBe(first);
  });
});

describe("what the device remembers", () => {
  it("writes both choices under its own versioned key, not another tab's", () => {
    const { result } = renderHook(() => useReminderSwitches());

    act(() => result.current.setSwitch("chime", true));

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      banner: true,
      chime: true,
    });
    expect(localStorage.getItem("family:task-filters:v1")).toBeNull();
    expect(localStorage.getItem("family:reminders-shown:v1")).toBeNull();
  });

  it("reads a stored choice back the first time the hook is used", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ banner: false, chime: true }));
    resetReminderSwitches();

    const { result } = renderHook(() => useReminderSwitches());

    expect(result.current.switches).toEqual({ banner: false, chime: true });
    expect(result.current.persistent).toBe(true);
  });

  it("survives a reload of the page that made the change", () => {
    const first = renderHook(() => useReminderSwitches());
    act(() => first.result.current.setSwitch("banner", false));

    resetReminderSwitches(); // a fresh tab, reading the same device's storage
    const second = renderHook(() => useReminderSwitches());

    expect(second.result.current.switches.banner).toBe(false);
  });

  it("falls back per switch, so one corrupt half never poisons the other", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ banner: "no", chime: true }));
    resetReminderSwitches();

    const { result } = renderHook(() => useReminderSwitches());

    expect(result.current.switches).toEqual({ banner: true, chime: true });
  });

  it("ignores a stored value that is not an object of switches at all", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["chime"]));
    resetReminderSwitches();

    const { result } = renderHook(() => useReminderSwitches());

    expect(result.current.switches).toEqual({ banner: true, chime: false });
  });
});

describe("storage that will not have it (constitution §VI)", () => {
  it("falls back to the defaults when the stored value is corrupt, and does not throw", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    resetReminderSwitches();

    const mount = () => renderHook(() => useReminderSwitches());

    expect(mount).not.toThrow();
    const { result } = mount();
    expect(result.current.switches).toEqual({ banner: true, chime: false });
    expect(result.current.persistent).toBe(false);
  });

  it("keeps working in memory when the read is refused outright, and says so", () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage is disabled");
    });
    resetReminderSwitches();

    const { result } = renderHook(() => useReminderSwitches());

    expect(result.current.switches).toEqual({ banner: true, chime: false });
    expect(result.current.persistent).toBe(false);
    getItem.mockRestore();
  });

  it("still lets somebody silence this device when nothing can be remembered", () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage is disabled");
    });
    resetReminderSwitches();

    const { result } = renderHook(() => useReminderSwitches());
    act(() => result.current.setSwitch("banner", false));

    expect(result.current.switches.banner).toBe(false);
    getItem.mockRestore();
  });

  it("keeps the flip for this session when the write is refused, and says so", () => {
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    const { result } = renderHook(() => useReminderSwitches());
    act(() => result.current.setSwitch("chime", true));

    expect(result.current.switches.chime).toBe(true);
    expect(result.current.persistent).toBe(false);
    setItem.mockRestore();
  });

  it("reports persistent again once the device is given working storage", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    resetReminderSwitches();
    renderHook(() => useReminderSwitches());

    localStorage.clear();
    resetReminderSwitches();
    const { result } = renderHook(() => useReminderSwitches());

    expect(result.current.persistent).toBe(true);
  });
});

describe("no browser permission is involved", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "Notification");
  });

  it("never asks the browser to allow anything, because a banner is only a DOM node", () => {
    const requestPermission = vi.fn();
    const readPermission = vi.fn(() => "default");
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: {
        requestPermission,
        get permission() {
          return readPermission();
        },
      },
    });

    const { result } = renderHook(() => useReminderSwitches());
    act(() => result.current.setSwitch("banner", true));
    act(() => result.current.setSwitch("chime", true));

    expect(requestPermission).not.toHaveBeenCalled();
    expect(readPermission).not.toHaveBeenCalled();
  });

  it("offers exactly two switches, neither of them a permission state", () => {
    const { result } = renderHook(() => useReminderSwitches());

    expect(Object.keys(result.current.switches).sort()).toEqual(["banner", "chime"]);
  });
});

describe("one store, every screen on this device", () => {
  it("publishes a change to every reader, so Settings and the banner agree", () => {
    const settings = renderHook(() => useReminderSwitches());
    const banner = renderHook(() => useReminderSwitches());

    act(() => settings.result.current.setSwitch("banner", false));

    expect(banner.result.current.switches.banner).toBe(false);
  });

  it("keeps its setter stable, so a render below it is not invalidated", () => {
    const { result, rerender } = renderHook(() => useReminderSwitches());
    const first = result.current.setSwitch;

    rerender();

    expect(result.current.setSwitch).toBe(first);
  });
});
