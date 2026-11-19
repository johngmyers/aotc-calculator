import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import {createTranslator, EN_US_BUNDLE, type MessageBundle,} from "../../src/ui/i18n.js";
import {AotcDependentCalculator} from "../../src/ui/AotcDependentCalculator.js";
import {makePigLatinTranslator} from "./pigLatin.js";

afterEach(() => {
    cleanup();
});

describe("AotcDependentCalculator", () => {
    it("renders title, subtitle, and defaults VITA/TCE scope checkbox to unchecked", () => {
        render(<AotcDependentCalculator/>);

        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "American Opportunity Tax Credit (AOTC) Optimizing Calculator",
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByText("For claimants with dependent students"),
        ).toBeInTheDocument();

        const checkbox = screen.getByRole("checkbox", {
            name: "Stay within scope for VITA/TCE",
        });
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
    });

    it("toggles the VITA/TCE scope checkbox state on click", () => {
        render(<AotcDependentCalculator/>);
        const checkbox = screen.getByRole("checkbox", {
            name: "Stay within scope for VITA/TCE",
        });

        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    it("renders scope exclusions as semantic HTML rather than escaped raw tags", () => {
        render(<AotcDependentCalculator/>);

        expect(screen.queryByText(/<ul>/i)).toBeNull();
        expect(screen.queryByText(/<li>/i)).toBeNull();

        const list = screen.getByRole("list");
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(14);
        expect(items[0]).toHaveTextContent(/Qualified Business Income \(QBI\)/);
    });

    it("exposes a localized calculator settings landmark and interactive help tooltip", () => {
        const pig = makePigLatinTranslator();
        render(<AotcDependentCalculator t={pig}/>);

        const region = screen.getByRole("region", {
            name: pig("calculatorSettingsSectionLabel"),
        });
        expect(region).toBeInTheDocument();

        const checkbox = within(region).getByRole("checkbox");
        expect(checkbox).toHaveAccessibleName(pig("stayWithinVitaScopeLabel"));

        const triggerLabel =
            pig.try("stayWithinVitaScopeTooltipLabel") ??
            pig("helpTooltipDefaultTriggerLabel");
        const button = within(region).getByRole("button", {name: triggerLabel});

        expect(screen.queryByRole("tooltip")).toBeNull();

        fireEvent.focus(button);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent(/8615/);
        expect(tooltip).not.toHaveTextContent(/Keeps student returns within/i);
        expect(button).toHaveAttribute("aria-describedby", tooltip.id);

        fireEvent.keyDown(button, {key: "Escape"});
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("renders localized scope exclusions as semantic HTML using an explicit bundle", () => {
        const customBundle: MessageBundle = {
            ...EN_US_BUNDLE,
            scopeExclusionsBlurb:
                "<p>Excluded for <b>student</b> return:</p><ul><li>First exclusion</li><li>Second exclusion</li></ul>",
        };
        const translator = createTranslator(customBundle);

        render(<AotcDependentCalculator t={translator}/>);

        expect(screen.queryByText(/<ul>/i)).toBeNull();
        expect(screen.queryByText(/<li>/i)).toBeNull();

        const list = screen.getByRole("list");
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent("First exclusion");
        expect(items[1]).toHaveTextContent("Second exclusion");
    });
});
