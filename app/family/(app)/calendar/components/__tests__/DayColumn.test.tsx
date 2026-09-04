import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DayColumn } from "../DayColumn";

/**
 * T050 — FR-254's second way to create: a plain tap on empty grid, no long
 * press. The column reports that day and the 15-minute slot under the tap
 * (FR-255); the one-hour default is the form seed's business.
 */

const ZONE = "America/Chicago";

function renderColumn(onSlotTap = vi.fn()) {
  const view = render(
    <DayColumn
      date="2026-09-04"
      todayDate={null}
      zone={ZONE}
      timeFormat="12h"
      segments={[]}
      overflow={[]}
      colorsById={{}}
      onSlotTap={onSlotTap}
    />,
  );
  const cell = (hour: number): HTMLElement => {
    const node = view.container.querySelector<HTMLElement>(`[data-hour="${hour}"]`);
    if (!node) throw new Error(`no hour cell for ${hour}`);
    return node;
  };
  return { ...view, onSlotTap, cell };
}

describe("DayColumn slot taps", () => {
  it("reports the column's date and the hour's first quarter for an unmeasured cell", () => {
    const { onSlotTap, cell } = renderColumn();

    fireEvent.click(cell(9));

    expect(onSlotTap).toHaveBeenCalledExactlyOnceWith("2026-09-04", 540);
  });

  it("resolves the 15-minute slot from where in the hour cell the tap landed (FR-255)", () => {
    const { onSlotTap, cell } = renderColumn();
    const target = cell(14);
    target.getBoundingClientRect = () =>
      ({ top: 100, height: 200, bottom: 300, left: 0, right: 0, width: 0, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;

    fireEvent.click(target, { clientY: 260 }); // 80% down → the :45 quarter

    expect(onSlotTap).toHaveBeenCalledExactlyOnceWith("2026-09-04", 14 * 60 + 45);
  });

  it("renders no slot handler at all when the grid is read-only", () => {
    const view = render(
      <DayColumn
        date="2026-09-04"
        todayDate={null}
        zone={ZONE}
        timeFormat="12h"
        segments={[]}
        overflow={[]}
        colorsById={{}}
      />,
    );

    expect(() => fireEvent.click(view.container.querySelector('[data-hour="9"]')!)).not.toThrow();
  });
});
