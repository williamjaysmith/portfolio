import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { SortableStopItem } from "@/app/colectivo/routes/SortableStopItem";
import { type Stop, OUT_OF_ROUTE_COLOR } from "@/lib/colectivo";

const stop: Stop = { id: "hilldale", name: "Colectivo Hilldale", address: "702 N Midvale Blvd" };

function renderItem(props: Partial<React.ComponentProps<typeof SortableStopItem>> = {}) {
  const merged = {
    stop,
    outOfRoute: false,
    delivered: false,
    note: "",
    onToggleDelivered: vi.fn(),
    onNoteChange: vi.fn(),
    ...props,
  };
  const { container } = render(
    <DndContext>
      <SortableContext items={[stop.id]}>
        <SortableStopItem {...merged} />
      </SortableContext>
    </DndContext>,
  );
  return { ...merged, container };
}

describe("SortableStopItem", () => {
  it("shows the name and address", () => {
    renderItem();
    expect(screen.getByText("Colectivo Hilldale")).toBeInTheDocument();
    expect(screen.getByText("702 N Midvale Blvd")).toBeInTheDocument();
  });

  it("links directions to the Google Maps URL", () => {
    renderItem();
    const link = screen.getByRole("link", { name: /directions/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps/dir/?api=1&destination=702"),
    );
  });

  it("marks an out-of-route stop with a single-color left stripe (no city pill)", () => {
    const { container } = renderItem({ outOfRoute: true });
    expect(screen.queryByText("Milwaukee")).toBeNull();
    expect(container.firstChild).toHaveStyle({ borderLeftColor: OUT_OF_ROUTE_COLOR });
  });

  it("does not render a remove button without onRemove", () => {
    renderItem();
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });

  it("renders a remove button when onRemove is provided and calls it", () => {
    const onRemove = vi.fn();
    renderItem({ outOfRoute: true, onRemove });
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("opens a confirm pop-up before calling onToggleDelivered", () => {
    const merged = renderItem();
    fireEvent.click(screen.getByRole("button", { name: /mark colectivo hilldale delivered/i }));
    expect(merged.onToggleDelivered).not.toHaveBeenCalled();
    // The pop-up "Yes" confirms the delivery.
    fireEvent.click(screen.getByRole("button", { name: /yes, delivered to colectivo hilldale/i }));
    expect(merged.onToggleDelivered).toHaveBeenCalled();
  });
});
