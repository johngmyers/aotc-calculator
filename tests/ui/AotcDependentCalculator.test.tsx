import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AotcDependentCalculator } from "../../src/ui/AotcDependentCalculator.js";

describe("AotcDependentCalculator", () => {
  it("renders title, subtitle, and defaults VITA/TCE scope checkbox to unchecked", () => {
    render(<AotcDependentCalculator />);

    expect(
      screen.getByRole("heading", {
        name: "American Opportunity Tax Credit (AOTC) Optimizing Calculator",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("for claimants with dependent students"),
    ).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", {
      name: "Stay within scope for VITA/TCE",
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });
});
