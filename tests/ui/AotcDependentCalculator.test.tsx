import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {createTranslator, EN_US_BUNDLE, type MessageBundle,} from "../../src/ui/i18n.js";
import {AotcDependentCalculator} from "../../src/ui/AotcDependentCalculator.js";
import {makePigLatinTranslator} from "./pigLatin.js";
import {FederalRules} from "../../src/rules/federal.js";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const expectedYears = Object.keys(FederalRules)
    .map(Number)
    .filter(Number.isInteger)
    .sort((a, b) => b - a);

const maxAvailableYear = Math.max(...expectedYears);

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

    it("populates tax-year options from FederalRules keys", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);
        const select = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;

        const optionValues = Array.from(select.options).map((opt) => Number(opt.value));
        expect(optionValues.sort((a, b) => b - a)).toEqual(expectedYears);
    });

    it("defaults to previous year on or before October 15 and current year after October 15 when present", () => {
        const refYear = expectedYears.length >= 2 ? expectedYears[0] : maxAvailableYear;
        const prevYear = refYear - 1;

        render(<AotcDependentCalculator now={new Date(refYear, 9, 15)}/>);
        const oct15Select = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;
        if (expectedYears.includes(prevYear)) {
            expect(Number(oct15Select.value)).toBe(prevYear);
        }

        cleanup();

        render(<AotcDependentCalculator now={new Date(refYear, 9, 16)}/>);
        const oct16Select = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;
        if (expectedYears.includes(refYear)) {
            expect(Number(oct16Select.value)).toBe(refYear);
        }
    });

    it("falls back to the highest year in FederalRules when candidate year is absent", () => {
        render(<AotcDependentCalculator now={new Date(1900, 0, 1)}/>);
        const select = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;

        expect(Number(select.value)).toBe(maxAvailableYear);
    });

    it("updates selected tax year when changed by the user", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);
        const select = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;

        const targetYear = expectedYears.find((y) => y !== Number(select.value)) ?? maxAvailableYear;
        fireEvent.change(select, {target: {value: String(targetYear)}});
        expect(Number(select.value)).toBe(targetYear);
    });
});

describe("Claimant section", () => {
    it("renders a Claimant landmark region, defaults filing status to MFJ, and orders options properly", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        expect(claimantRegion).toBeInTheDocument();

        expect(
            within(claimantRegion).getByRole("heading", {
                level: 2,
                name: EN_US_BUNDLE.claimantSectionTitle,
            }),
        ).toBeInTheDocument();

        const select = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        expect(select.value).toBe("mfj");

        const optionValues = Array.from(select.options).map((opt) => opt.value);
        expect(optionValues).toEqual(["single", "hoh", "mfj", "mfs", "qss"]);

        const optionLabels = Array.from(select.options).map((opt) => opt.textContent);
        expect(optionLabels).toEqual([
            EN_US_BUNDLE.filingStatusSingle,
            EN_US_BUNDLE.filingStatusHoh,
            EN_US_BUNDLE.filingStatusMfj,
            EN_US_BUNDLE.filingStatusMfs,
            EN_US_BUNDLE.filingStatusQss,
        ]);
    });

    it("updates claimant filing status when changed by the user", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const select = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        fireEvent.change(select, {target: {value: "hoh"}});
        expect(select.value).toBe("hoh");
    });

    it("localizes the Claimant section heading, landmark, and filing status labels", () => {
        const pig = makePigLatinTranslator(EN_US_BUNDLE, {preserveHtmlTags: true});
        render(<AotcDependentCalculator t={pig}/>);

        const claimantRegion = screen.getByRole("region", {
            name: pig("claimantSectionTitle"),
        });
        expect(claimantRegion).toBeInTheDocument();

        const select = within(claimantRegion).getByRole("combobox", {
            name: pig("filingStatusLabel"),
        }) as HTMLSelectElement;

        const optionLabels = Array.from(select.options).map((opt) => opt.textContent);
        expect(optionLabels).toEqual([
            pig("filingStatusSingle"),
            pig("filingStatusHoh"),
            pig("filingStatusMfj"),
            pig("filingStatusMfs"),
            pig("filingStatusQss"),
        ]);
    });

    it("displays disallowed notice with warning symbol and keeps filing status dropdown visible for MFS", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const select = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        fireEvent.change(select, {target: {value: "mfs"}});
        expect(select.value).toBe("mfs");
        expect(select).toBeInTheDocument();

        const statusNotice = within(claimantRegion).getByRole("status");
        expect(statusNotice).toHaveTextContent(/⚠/);
        expect(statusNotice).toHaveTextContent(EN_US_BUNDLE.aotcDisallowedByFilingStatus);
    });

    it("removes the disallowed notice when switching back to an allowed filing status", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const select = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        fireEvent.change(select, {target: {value: "mfs"}});
        expect(within(claimantRegion).getByRole("status")).toBeInTheDocument();

        fireEvent.change(select, {target: {value: "mfj"}});
        expect(within(claimantRegion).queryByRole("status")).toBeNull();
        expect(select.value).toBe("mfj");
    });

    it("localizes the AOTC disallowed notice while preserving the warning symbol", () => {
        const pig = makePigLatinTranslator(EN_US_BUNDLE, {preserveHtmlTags: true});
        render(<AotcDependentCalculator t={pig}/>);

        const claimantRegion = screen.getByRole("region", {
            name: pig("claimantSectionTitle"),
        });
        const select = within(claimantRegion).getByRole("combobox", {
            name: pig("filingStatusLabel"),
        }) as HTMLSelectElement;

        fireEvent.change(select, {target: {value: "mfs"}});
        const statusNotice = within(claimantRegion).getByRole("status");
        expect(statusNotice).toHaveTextContent(/⚠/);
        expect(statusNotice).toHaveTextContent(pig("aotcDisallowedByFilingStatus"));
    });
});
