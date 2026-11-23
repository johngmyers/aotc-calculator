import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {createTranslator, EN_US_BUNDLE, type MessageBundle,} from "../../src/ui/i18n.js";
import {AotcDependentCalculator} from "../../src/ui/AotcDependentCalculator.js";
import {makePigLatinTranslator} from "./pigLatin.js";
import {FederalRules, FederalTaxYear} from "../../src/rules/federal.js";
import {getFederalLineRevision} from "../../src/rules/federalLines.js";

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
        const button = getTooltipButtonForInput(region, checkbox, triggerLabel);

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

    it("renders AGI input, label, and line tooltip inside Claimant section", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        }) as HTMLInputElement;

        expect(agiInput).toBeInTheDocument();
        expect(agiInput.value).toBe("");

        const triggerLabel =
            EN_US_BUNDLE.agiTooltipLabel ?? EN_US_BUNDLE.helpTooltipDefaultTriggerLabel;
        const tooltipTrigger = getTooltipButtonForInput(claimantRegion, agiInput, triggerLabel);
        fireEvent.focus(tooltipTrigger);

        const tooltip = screen.getByRole("tooltip");
        const agiRef = getFederalLineRevision(2026).agi;
        expect(tooltip).toHaveTextContent(
            new RegExp(`${agiRef.form}.*${agiRef.line}`, "i"),
        );
    });

    it("formats claimant AGI with commas and preserves it across filing status changes", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        }) as HTMLInputElement;
        const filingStatusSelect = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        fireEvent.change(agiInput, {target: {value: "85000"}});
        expect(agiInput.value).toBe("85,000");

        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        expect(agiInput.value).toBe("85,000");

        fireEvent.change(filingStatusSelect, {target: {value: "mfj"}});
        expect(agiInput.value).toBe("85,000");
    });

    it("updates claimant AGI tooltip line when tax year changes", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const yearSelect = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;
        const nextYear = expectedYears.find((y) => y !== Number(yearSelect.value));

        if (nextYear !== undefined) {
            fireEvent.change(yearSelect, {target: {value: String(nextYear)}});
        }

        const activeYear = Number(yearSelect.value);
        const expectedRef = getFederalLineRevision(activeYear as FederalTaxYear).agi;
        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        });
        const triggerLabel =
            EN_US_BUNDLE.agiTooltipLabel ?? EN_US_BUNDLE.helpTooltipDefaultTriggerLabel;
        const tooltipTrigger = getTooltipButtonForInput(claimantRegion, agiInput, triggerLabel);

        fireEvent.focus(tooltipTrigger);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent(
            new RegExp(`${expectedRef.form}.*${expectedRef.line}`, "i"),
        );
    });

    it("renders required asterisks on AGI and tax before nonrefundable credits", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const asterisks = claimantRegion.querySelectorAll(".required-indicator");
        expect(asterisks).toHaveLength(2);
        asterisks.forEach((el) => {
            expect(el).toHaveAttribute("aria-hidden", "true");
            expect(el).toHaveTextContent("*");
        });

        const agiRow = within(claimantRegion)
            .getByRole("textbox", {name: EN_US_BUNDLE.agiLabel})
            .closest("div")!;
        const taxRow = within(claimantRegion)
            .getByRole("textbox", {name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel})
            .closest("div")!;
        const creditsRow = within(claimantRegion)
            .getByRole("textbox", {name: EN_US_BUNDLE.nonrefundableCreditsLabel})
            .closest("div")!;

        expect(agiRow.querySelector(".required-indicator")).not.toBeNull();
        expect(taxRow.querySelector(".required-indicator")).not.toBeNull();
        expect(creditsRow.querySelector(".required-indicator")).toBeNull();
    });

    it("hides everything after the disallowed notice when filing status disallows AOTC", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const filingStatusSelect = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});

        const statusNotice = within(claimantRegion).getByRole("status");
        const allElements = Array.from(claimantRegion.querySelectorAll<HTMLElement>("*"));
        const noticeIndex = allElements.indexOf(statusNotice);
        expect(noticeIndex).toBeGreaterThan(-1);

        const elementsAfterNotice = allElements
            .slice(noticeIndex + 1)
            .filter((el) => !statusNotice.contains(el));

        expect(elementsAfterNotice.length).toBeGreaterThan(0);

        const unhidden = elementsAfterNotice
            .filter((el) => el.closest("[hidden]") === null)
            .map((el) => {
                const text = (el.textContent ?? "").trim().slice(0, 40);
                const idPart = el.id ? `#${el.id}` : "";
                const classPart = el.className ? `.${String(el.className).trim().split(/\s+/).join(".")}` : "";
                return `<${el.tagName.toLowerCase()}${idPart}${classPart}> (${JSON.stringify(text)})`;
            });

        expect(unhidden, `Unhidden elements after disallowed notice:\n${unhidden.join("\n")}`).toEqual([]);
    });

    it("validates required AGI on blur and clears on entry", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        }) as HTMLInputElement;

        fireEvent.blur(agiInput);
        expect(agiInput).toHaveAttribute("aria-invalid", "true");
        expect(within(claimantRegion).getByRole("alert")).toHaveTextContent(
            EN_US_BUNDLE.valueIsRequired,
        );

        fireEvent.change(agiInput, {target: {value: "50000"}});
        expect(agiInput).not.toHaveAttribute("aria-invalid", "true");
        expect(within(claimantRegion).queryByRole("alert")).toBeNull();
    });

    it("renders tax before nonrefundable credits input and line tooltip inside Claimant section", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const taxInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel,
        }) as HTMLInputElement;

        expect(taxInput).toBeInTheDocument();
        expect(taxInput.value).toBe("");

        const triggerLabel =
            EN_US_BUNDLE.taxBeforeNonrefundableCreditsTooltipLabel ??
            EN_US_BUNDLE.helpTooltipDefaultTriggerLabel;
        const tooltipTrigger = getTooltipButtonForInput(claimantRegion, taxInput, triggerLabel);
        fireEvent.focus(tooltipTrigger);

        const tooltip = screen.getByRole("tooltip");
        const taxRef = getFederalLineRevision(2026).taxBeforeNonrefundableCredits;
        expect(tooltip).toHaveTextContent(
            new RegExp(`${taxRef.form}.*${taxRef.line}`, "i"),
        );
    });

    it("formats tax before nonrefundable credits with commas and preserves it across filing status changes", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const taxInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel,
        }) as HTMLInputElement;
        const filingStatusSelect = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        fireEvent.change(taxInput, {target: {value: "12500"}});
        expect(taxInput.value).toBe("12,500");

        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        expect(taxInput.value).toBe("12,500");

        fireEvent.change(filingStatusSelect, {target: {value: "mfj"}});
        expect(taxInput.value).toBe("12,500");
    });

    it("updates tax before nonrefundable credits tooltip line when tax year changes", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const yearSelect = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;
        const nextYear = expectedYears.find((y) => y !== Number(yearSelect.value));

        if (nextYear !== undefined) {
            fireEvent.change(yearSelect, {target: {value: String(nextYear)}});
        }

        const activeYear = Number(yearSelect.value);
        const expectedRef = getFederalLineRevision(activeYear as FederalTaxYear)
            .taxBeforeNonrefundableCredits;
        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const taxInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel,
        });
        const triggerLabel =
            EN_US_BUNDLE.taxBeforeNonrefundableCreditsTooltipLabel ??
            EN_US_BUNDLE.helpTooltipDefaultTriggerLabel;
        const tooltipTrigger = getTooltipButtonForInput(claimantRegion, taxInput, triggerLabel);

        fireEvent.focus(tooltipTrigger);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent(
            new RegExp(`${expectedRef.form}.*${expectedRef.line}`, "i"),
        );
    });

    it("validates required tax before nonrefundable credits on blur and clears on entry", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const taxInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel,
        }) as HTMLInputElement;

        fireEvent.blur(taxInput);
        expect(taxInput).toHaveAttribute("aria-invalid", "true");
        expect(within(claimantRegion).getByRole("alert")).toHaveTextContent(
            EN_US_BUNDLE.valueIsRequired,
        );

        fireEvent.change(taxInput, {target: {value: "8000"}});
        expect(taxInput).not.toHaveAttribute("aria-invalid", "true");
        expect(within(claimantRegion).queryByRole("alert")).toBeNull();
    });

    it("renders nonrefundable credits input and line tooltip inside Claimant section", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        }) as HTMLInputElement;

        expect(creditsInput).toBeInTheDocument();
        expect(creditsInput.value).toBe("");

        const triggerLabel =
            EN_US_BUNDLE.nonrefundableCreditsTooltipLabel ??
            EN_US_BUNDLE.helpTooltipDefaultTriggerLabel;
        const tooltipTrigger = getTooltipButtonForInput(claimantRegion, creditsInput, triggerLabel);
        fireEvent.focus(tooltipTrigger);

        const tooltip = screen.getByRole("tooltip");
        const creditsRef = getFederalLineRevision(2026).nonrefundableCredits;
        expect(tooltip).toHaveTextContent(
            new RegExp(`${creditsRef.form}.*${creditsRef.line}`, "i"),
        );
    });

    it("formats nonrefundable credits with commas and preserves it across filing status changes", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        }) as HTMLInputElement;
        const filingStatusSelect = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        }) as HTMLSelectElement;

        fireEvent.change(creditsInput, {target: {value: "4200"}});
        expect(creditsInput.value).toBe("4,200");

        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        expect(creditsInput.value).toBe("4,200");

        fireEvent.change(filingStatusSelect, {target: {value: "mfj"}});
        expect(creditsInput.value).toBe("4,200");
    });

    it("updates nonrefundable credits tooltip line when tax year changes", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const yearSelect = screen.getByRole("combobox", {
            name: EN_US_BUNDLE.taxYearLabel,
        }) as HTMLSelectElement;
        const nextYear = expectedYears.find((y) => y !== Number(yearSelect.value));

        if (nextYear !== undefined) {
            fireEvent.change(yearSelect, {target: {value: String(nextYear)}});
        }

        const activeYear = Number(yearSelect.value);
        const expectedRef = getFederalLineRevision(activeYear as FederalTaxYear)
            .nonrefundableCredits;
        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        });
        const triggerLabel =
            EN_US_BUNDLE.nonrefundableCreditsTooltipLabel ??
            EN_US_BUNDLE.helpTooltipDefaultTriggerLabel;
        const tooltipTrigger = getTooltipButtonForInput(claimantRegion, creditsInput, triggerLabel);

        fireEvent.focus(tooltipTrigger);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent(
            new RegExp(`${expectedRef.form}.*${expectedRef.line}`, "i"),
        );
    });

    it("allows nonrefundable credits to remain empty on blur without required error", () => {
        render(<AotcDependentCalculator/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        }) as HTMLInputElement;

        fireEvent.blur(creditsInput);
        expect(creditsInput).not.toHaveAttribute("aria-invalid", "true");
        expect(within(claimantRegion).queryByRole("alert")).toBeNull();
    });
});

describe("Early results when AOTC provides no benefit to claimant", () => {
    it("does not show early results before AGI is entered", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const tbncInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        });

        fireEvent.change(tbncInput, {target: {value: "5000"}});
        fireEvent.change(creditsInput, {target: {value: "1000"}});

        expect(
            screen.queryByRole("region", {name: EN_US_BUNDLE.resultsSectionTitle}),
        ).toBeNull();
    });

    it("publishes early Results when AGI phases out AOTC completely even before TBNC is entered", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        });

        fireEvent.change(agiInput, {target: {value: "200000"}});

        const resultsRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.resultsSectionTitle,
        });
        expect(resultsRegion).toBeInTheDocument();
        expect(
            within(resultsRegion).getByRole("heading", {
                level: 2,
                name: EN_US_BUNDLE.resultsSectionTitle,
            }),
        ).toBeInTheDocument();
        expect(within(resultsRegion).getByRole("status")).toHaveTextContent(
            EN_US_BUNDLE.noAotcBenefitSummary,
        );
    });

    it("publishes early Results when AGI phases out AOTC and NC is entered while TBNC is omitted", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        });

        fireEvent.change(agiInput, {target: {value: "200000"}});
        fireEvent.change(creditsInput, {target: {value: "2500"}});

        const resultsRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.resultsSectionTitle,
        });
        expect(resultsRegion).toBeInTheDocument();
        expect(within(resultsRegion).getByRole("status")).toHaveTextContent(
            EN_US_BUNDLE.noAotcBenefitSummary,
        );
    });

    it("does not publish early Results from defaulted TBNC when AGI is in-range and TBNC is omitted", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        });

        fireEvent.change(agiInput, {target: {value: "50000"}});

        expect(
            screen.queryByRole("region", {name: EN_US_BUNDLE.resultsSectionTitle}),
        ).toBeNull();
    });

    it("publishes early Results when claimant is refundable-ineligible and nonrefundable credits already equal or exceed TBNC", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const filingStatusSelect = within(claimantRegion).getByRole("combobox", {
            name: EN_US_BUNDLE.filingStatusLabel,
        });
        fireEvent.change(filingStatusSelect, {target: {value: "single"}});

        const under18Radio = within(claimantRegion).getByRole("radio", {
            name: /0-17/i,
        });
        fireEvent.click(under18Radio);

        const tbncInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        });

        fireEvent.change(tbncInput, {target: {value: "3000"}});
        fireEvent.change(creditsInput, {target: {value: "3000"}});

        const resultsRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.resultsSectionTitle,
        });
        expect(resultsRegion).toBeInTheDocument();
        expect(within(resultsRegion).getByRole("status")).toHaveTextContent(
            EN_US_BUNDLE.noAotcBenefitSummary,
        );
    });

    it("does not publish early Results when TBNC exceeds nonrefundable credits and AOTC can still help", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        });
        const tbncInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.taxBeforeNonrefundableCreditsLabel,
        });
        const creditsInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.nonrefundableCreditsLabel,
        });

        fireEvent.change(agiInput, {target: {value: "50000"}});
        fireEvent.change(tbncInput, {target: {value: "5000"}});
        fireEvent.change(creditsInput, {target: {value: "1000"}});

        expect(
            screen.queryByRole("region", {name: EN_US_BUNDLE.resultsSectionTitle}),
        ).toBeNull();
    });

    it("hides everything after the early Results section in DOM order", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        });

        fireEvent.change(agiInput, {target: {value: "200000"}});

        const resultsRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.resultsSectionTitle,
        });
        const main = screen.getByRole("main");
        const allElements = Array.from(main.querySelectorAll<HTMLElement>("*"));
        const resultsIndex = allElements.indexOf(resultsRegion);
        expect(resultsIndex).toBeGreaterThan(-1);

        const elementsAfterResults = allElements
            .slice(resultsIndex + 1)
            .filter((el) => !resultsRegion.contains(el));

        const unhidden = elementsAfterResults
            .filter((el) => el.closest("[hidden]") === null)
            .map((el) => {
                const text = (el.textContent ?? "").trim().slice(0, 40);
                const idPart = el.id ? `#${el.id}` : "";
                const classPart = el.className
                    ? `.${String(el.className).trim().split(/\s+/).join(".")}`
                    : "";
                return `<${el.tagName.toLowerCase()}${idPart}${classPart}> (${JSON.stringify(text)})`;
            });

        expect(
            unhidden,
            `Unhidden elements after early Results section:\n${unhidden.join("\n")}`,
        ).toEqual([]);
    });

    it("retracts early Results when AGI is lowered back into eligible range", () => {
        render(<AotcDependentCalculator now={new Date(2026, 10, 18)}/>);

        const claimantRegion = screen.getByRole("region", {
            name: EN_US_BUNDLE.claimantSectionTitle,
        });
        const agiInput = within(claimantRegion).getByRole("textbox", {
            name: EN_US_BUNDLE.agiLabel,
        });

        fireEvent.change(agiInput, {target: {value: "200000"}});
        expect(
            screen.getByRole("region", {name: EN_US_BUNDLE.resultsSectionTitle}),
        ).toBeInTheDocument();

        fireEvent.change(agiInput, {target: {value: "50000"}});
        expect(
            screen.queryByRole("region", {name: EN_US_BUNDLE.resultsSectionTitle}),
        ).toBeNull();
    });
});

describe("Student section", () => {
    const pig = makePigLatinTranslator();

    it("passes the translator through and renders one student section by default", () => {
        render(
            <AotcDependentCalculator
                t={pig}
                now={new Date("2026-11-23T12:00:00Z")}
            />,
        );

        const expectedTitle = pig("studentSectionTitle", {number: 1});
        const headings = screen.getAllByRole("heading", {name: expectedTitle});
        expect(headings).toHaveLength(1);
        expect(headings[0].closest("section")).not.toHaveAttribute("hidden");
        expect(
            screen.getByLabelText(pig("studentNameLabel")),
        ).not.toHaveAttribute("hidden");
    });

    it("gates the wired student section when claimant filing status is MFS", () => {
        render(
            <AotcDependentCalculator
                t={pig}
                now={new Date("2026-11-23T12:00:00Z")}
            />,
        );

        fireEvent.change(screen.getByLabelText(pig("filingStatusLabel")), {
            target: {value: "mfs"},
        });

        const expectedTitle = pig("studentSectionTitle", {number: 1});
        expect(
            screen
                .getByRole("heading", {name: expectedTitle, hidden: true})
                .closest("section"),
        ).toHaveAttribute("hidden");
        expect(
            screen.getByLabelText(pig("studentNameLabel")),
        ).toHaveAttribute("hidden");
    });

    it("gates the wired student section when claimant has no AOTC benefit", () => {
        render(
            <AotcDependentCalculator
                t={pig}
                now={new Date("2026-11-23T12:00:00Z")}
            />,
        );

        fireEvent.change(screen.getByLabelText(pig("agiLabel")), {
            target: {value: "500000"},
        });

        expect(
            screen.getByRole("heading", {name: pig("resultsSectionTitle")}),
        ).toBeInTheDocument();
        const expectedTitle = pig("studentSectionTitle", {number: 1});
        expect(
            screen
                .getByRole("heading", {name: expectedTitle, hidden: true})
                .closest("section"),
        ).toHaveAttribute("hidden");
    });
});

function getTooltipButtonForInput(
    root: HTMLElement,
    input: HTMLElement,
    triggerName: string = EN_US_BUNDLE.helpTooltipDefaultTriggerLabel,
): HTMLElement {
    const containerDiv = input.closest("div");
    if (!containerDiv) {
        throw new Error("Input is not inside a div");
    }

    const matchingButtons = new Set(within(root).queryAllByRole("button", {name: triggerName}));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    walker.currentNode = input;

    let current = walker.nextNode() as HTMLElement | null;
    while (current && containerDiv.contains(current)) {
        if (current.tagName === "BUTTON" && matchingButtons.has(current)) {
            return current;
        }
        current = walker.nextNode() as HTMLElement | null;
    }

    throw new Error(`Missing tooltip button "${triggerName}" within surrounding div`);
}
