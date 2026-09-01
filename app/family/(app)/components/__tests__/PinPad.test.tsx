import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PinPad } from "../PinPad";

/** FR-010: four digits, entered on a pad that is usable by touch and keyboard. */
describe("PinPad", () => {
  it("submits automatically on the fourth digit", () => {
    const onComplete = vi.fn();
    render(<PinPad onComplete={onComplete} />);

    for (const digit of ["1", "2", "3"]) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("1234");
  });

  it("never sends more than four digits", () => {
    const onComplete = vi.fn();
    render(<PinPad onComplete={onComplete} />);

    for (const digit of ["1", "2", "3", "4", "5"]) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("1234");
  });

  it("removes the last digit on backspace", () => {
    const onComplete = vi.fn();
    render(<PinPad onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete last digit" }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("1345");
  });

  it("accepts physical keyboard digits (SC-009)", () => {
    const onComplete = vi.fn();
    render(<PinPad onComplete={onComplete} />);
    const pin = screen.getByLabelText("PIN");

    for (const key of ["9", "8", "7", "6"]) {
      fireEvent.keyDown(pin, { key });
    }
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("9876");
  });

  it("accepts nothing while disabled — a locked profile cannot keep guessing", () => {
    const onComplete = vi.fn();
    render(<PinPad disabled onComplete={onComplete} />);

    for (const digit of ["1", "2", "3", "4"]) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("clears the entered digits when the reset key changes", () => {
    const onComplete = vi.fn();
    const { rerender } = render(<PinPad onComplete={onComplete} resetKey={0} />);

    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));

    rerender(<PinPad onComplete={onComplete} resetKey={1} />);
    for (const digit of ["5", "5", "5", "5"]) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("5555");
  });
});
