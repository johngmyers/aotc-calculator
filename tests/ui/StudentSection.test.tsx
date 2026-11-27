import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {StudentSection} from "../../src/ui/StudentSection.js";
import {getTranslator, Translator} from "../../src/ui/i18n.js";
import {FILING_STATUS_LABEL_KEYS, FILING_STATUS_ORDER} from "../../src/ui/AotcDependentCalculator.js";
import {makePigLatinTranslator} from "./pigLatin.js";
import {tryGetTooltipButtonForInput} from "./helpers.js";

const testT: Translator = getTranslator("en-US");

const DEFAULT_PROPS = {
    taxYear: 2026 as const,
    expensesCap: 4_000,
    onExpenseCostsChange: vi.fn(),
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("StudentSection", () => {
    it("emits default Student {number} name on mount and keeps static heading", () => {
        const onNameChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={false}
                onNameChange={onNameChange}
                t={testT}
            />,
        );

        expect(screen.getByRole("heading", {name: "Student 1"})).toBeInTheDocument();
        expect(onNameChange).toHaveBeenLastCalledWith("Student 1");
        expect(screen.getByLabelText("Name")).toHaveValue("");
    });

    it("emits typed name and reverts to Student {number} when cleared or whitespace-only", () => {
        const onNameChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={2}
                hidden={false}
                onNameChange={onNameChange}
                t={testT}
            />,
        );

        const input = screen.getByLabelText("Name");
        fireEvent.change(input, {target: {value: "Clara"}});
        expect(onNameChange).toHaveBeenLastCalledWith("Clara");

        fireEvent.change(input, {target: {value: "   "}});
        expect(onNameChange).toHaveBeenLastCalledWith("Student 2");
        expect(screen.getByRole("heading", {name: "Student 2"})).toBeInTheDocument();
    });

    it("hides the section when hidden is true", () => {
        const {container} = render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={true}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const section = container.querySelector("section");
        expect(section).not.toBeNull();
        expect(section).toHaveAttribute("hidden");
    });

    it("defaults student filing status to single and renders all filing status options", () => {
        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const select = screen.getByLabelText(testT("filingStatusLabel")) as HTMLSelectElement;
        expect(select).toHaveValue("single");

        const options = Array.from(select.options).map((opt) => ({
            value: opt.value,
            label: opt.textContent,
        }));
        expect(options).toEqual(
            FILING_STATUS_ORDER.map((status) => ({
                value: status,
                label: testT(FILING_STATUS_LABEL_KEYS[status]),
            })),
        );
    });

    it("updates student filing status when changed", () => {
        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const select = screen.getByLabelText(testT("filingStatusLabel"));
        fireEvent.change(select, {target: {value: "mfj"}});
        expect(select).toHaveValue("mfj");

        fireEvent.change(select, {target: {value: "hoh"}});
        expect(select).toHaveValue("hoh");
    });

    it("increases AGI when shifting optional scholarships so incremental cost does not turn negative", () => {
        const onExpenseCostsChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                taxYear={2026}
                expensesCap={4_000}
                onExpenseCostsChange={onExpenseCostsChange}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        fireEvent.change(screen.getByLabelText(testT("agiLabel")), {
            target: {value: "4000"},
        });
        fireEvent.change(
            screen.getByLabelText(testT("studentOptionalTaxableScholarshipsLabel")),
            {target: {value: "1000"}},
        );

        const latestCosts = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(latestCosts).toBeDefined();

        const baselineCost = latestCosts![0].cost;
        const shifted1kCost = latestCosts![1000].cost;
        expect(shifted1kCost - baselineCost).toBeGreaterThan(0);
    });

    it("hides descendant controls when section hidden is true", () => {
        const {container} = render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={true}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const section = container.querySelector("section");
        expect(section).toHaveAttribute("hidden");
        expect(
            screen.getByLabelText(testT("studentMinimumTaxableScholarshipsLabel")),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(testT("studentMinimumEducationExpensesLabel")),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(testT("studentOptionalTaxableScholarshipsLabel")),
        ).toBeInTheDocument();
    });

    it("shows spouse itemizes checkbox only when filing status is mfs and preserves checked state across status toggles", () => {
        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const checkbox = screen.getByLabelText(testT("spouseItemizesDeductionsLabel")) as HTMLInputElement;
        const containerDiv = checkbox.closest("div")!;
        expect(containerDiv).toHaveAttribute("hidden");
        expect(checkbox).not.toBeChecked();

        const filingStatusSelect = screen.getByLabelText(testT("filingStatusLabel"));
        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        expect(containerDiv).not.toHaveAttribute("hidden");

        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        fireEvent.change(filingStatusSelect, {target: {value: "single"}});
        expect(containerDiv).toHaveAttribute("hidden");

        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        expect(containerDiv).not.toHaveAttribute("hidden");
        expect(checkbox).toBeChecked();
    });

    it("applies MFS $0 standard deduction when spouse itemizes, and charitable haircut instead of $0 deduction", () => {
        const onExpenseCostsChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                taxYear={2026}
                expensesCap={4_000}
                onExpenseCostsChange={onExpenseCostsChange}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const filingStatusSelect = screen.getByLabelText(testT("filingStatusLabel"));
        const checkbox = screen.getByLabelText(testT("spouseItemizesDeductionsLabel"));
        const agiInput = screen.getByLabelText(testT("agiLabel"));
        const cashGiftsInput = screen.getByLabelText(testT("cashGiftsToPublicCharitiesLabel"));
        const optionalScholarshipsInput = screen.getByLabelText(testT("studentOptionalTaxableScholarshipsLabel"));

        // MFS with spouse itemizing and no charitable gifts -> $0 deduction; AGI = 10,000 is all in 10% bracket.
        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        fireEvent.click(checkbox);
        fireEvent.change(agiInput, {target: {value: "10000"}});
        fireEvent.change(optionalScholarshipsInput, {target: {value: "1000"}});

        let latestCosts = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(latestCosts).toBeDefined();
        // Shifting $1,000 increases taxable income from $10,000 to $11,000 (10% bracket -> +$100).
        expect(latestCosts![1000].cost - latestCosts![0].cost).toBe(100);

        // AGI = 40,000 -> 0.5% charitable floor = 200; cash gifts = 1,000 -> 800 deduction at baseline.
        // At +1,000 shifted scholarship (AGI = 41,000), floor rises to 205 -> 795 deduction, taxable income +1,005 @ 12% = 120.60 -> 121.
        fireEvent.change(agiInput, {target: {value: "40000"}});
        fireEvent.change(cashGiftsInput, {target: {value: "1000"}});

        latestCosts = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(latestCosts).toBeDefined();
        expect(latestCosts![0].cost).toBe(4456);
        expect(latestCosts![1000].cost).toBe(4577);
        expect(latestCosts![1000].cost - latestCosts![0].cost).toBe(121);
    });

    it("has no effect from checking spouse itemizes when filing status is changed away from mfs", () => {
        const onExpenseCostsChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                taxYear={2026}
                expensesCap={4_000}
                onExpenseCostsChange={onExpenseCostsChange}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const filingStatusSelect = screen.getByLabelText(testT("filingStatusLabel"));
        const checkbox = screen.getByLabelText(testT("spouseItemizesDeductionsLabel"));
        const agiInput = screen.getByLabelText(testT("agiLabel"));
        const optionalScholarshipsInput = screen.getByLabelText(testT("studentOptionalTaxableScholarshipsLabel"));

        // With MFS + spouse itemizes at AGI = 15,000, deduction is $0:
        // baseline taxable = 15,000 -> 12,400 @ 10% + 2,600 @ 12% = 1,240 + 312 = 1,552;
        // shifted +1,000 -> 16,000 taxable -> 1,552 + 120 = 1,672.
        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        fireEvent.click(checkbox);
        fireEvent.change(agiInput, {target: {value: "15000"}});
        fireEvent.change(optionalScholarshipsInput, {target: {value: "1000"}});

        const mfsCosts = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(mfsCosts).toBeDefined();
        expect(mfsCosts![0].cost).toBe(1552);
        expect(mfsCosts![1000].cost).toBe(1672);

        // Switch away from MFS to Single while checkbox remains checked:
        // at i = 0, dependent standard deduction is max($1,350, $0 + $450) = $1,350 -> taxable = $13,650 -> $1,390;
        // at i = 1000, $1,000 taxable scholarship lifts dependent standard deduction to $1,450 -> taxable = $14,550 -> $1,498.
        fireEvent.change(filingStatusSelect, {target: {value: "single"}});

        const singleCosts = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(singleCosts).toBeDefined();
        expect(singleCosts![0].cost).toBe(1390);
        expect(singleCosts![1000].cost).toBe(1498);
    });


    it("computes taxes using both cash gifts to public charities and other charitable contributions", () => {
        const onExpenseCostsChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                taxYear={2026}
                expensesCap={4_000}
                onExpenseCostsChange={onExpenseCostsChange}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const filingStatusSelect = screen.getByLabelText(testT("filingStatusLabel"));
        const checkbox = screen.getByLabelText(testT("spouseItemizesDeductionsLabel"));
        const agiInput = screen.getByLabelText(testT("agiLabel"));
        const cashGiftsInput = screen.getByLabelText(testT("cashGiftsToPublicCharitiesLabel"));
        const otherGiftsInput = screen.getByLabelText(testT("otherCharitableContributionsLabel"));
        const optionalScholarshipsInput = screen.getByLabelText(testT("studentOptionalTaxableScholarshipsLabel"));

        // Use MFS + spouse itemizes so itemized charitable deductions apply directly.
        // AGI = 20,000 -> 0.5% floor = 100.
        // Cash gifts = 600 + Other charitable = 500 -> total 1,100; after 100 floor -> 1,000 deduction.
        // Baseline taxable = 19,000 -> 12,400 @ 10% + 6,600 @ 12% = 1,240 + 792 = 2,032.
        // Shifted +1,000 -> AGI = 21,000, floor = 105 -> deduction = 995, taxable = 20,005 -> 1,240 + 912.60 = 2,152.60 -> 2,153.
        fireEvent.change(filingStatusSelect, {target: {value: "mfs"}});
        fireEvent.click(checkbox);
        fireEvent.change(agiInput, {target: {value: "20000"}});
        fireEvent.change(cashGiftsInput, {target: {value: "600"}});
        fireEvent.change(otherGiftsInput, {target: {value: "500"}});
        fireEvent.change(optionalScholarshipsInput, {target: {value: "1000"}});

        const latestCosts = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(latestCosts).toBeDefined();
        expect(latestCosts![0].cost).toBe(2032);
        expect(latestCosts![1000].cost).toBe(2153);
    });

    it("emits an empty expense cost array when AGI is cleared after being set", () => {
        const onExpenseCostsChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                onExpenseCostsChange={onExpenseCostsChange}
                t={testT}
            />,
        );

        const agiInput = screen.getByLabelText(testT("agiLabel"));
        fireEvent.change(agiInput, {target: {value: "25000"}});
        expect((onExpenseCostsChange.mock.calls.at(-1)?.[0] as unknown[]).length).toBeGreaterThan(0);

        fireEvent.change(agiInput, {target: {value: ""}});
        expect(onExpenseCostsChange).toHaveBeenLastCalledWith([]);
    });

    it("caps generated expense cost points at expensesCap even when optional scholarships are higher", () => {
        const onExpenseCostsChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                expensesCap={250}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                onExpenseCostsChange={onExpenseCostsChange}
                t={testT}
            />,
        );

        fireEvent.change(screen.getByLabelText(testT("agiLabel")), {target: {value: "20000"}});
        fireEvent.change(
            screen.getByLabelText(testT("studentOptionalTaxableScholarshipsLabel")),
            {target: {value: "1000"}},
        );

        const latestCosts = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(latestCosts).toHaveLength(251);
        expect(latestCosts!.at(-1)?.qualifiedExpenses).toBe(250);
    });

    it("passes medicalExpenses and salt into tax calculations when itemizing", () => {
        const onExpenseCostsChange = vi.fn();

        render(
            <StudentSection
                {...DEFAULT_PROPS}
                taxYear={2026}
                expensesCap={4_000}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                onExpenseCostsChange={onExpenseCostsChange}
                t={testT}
            />,
        );

        fireEvent.change(screen.getByLabelText(testT("filingStatusLabel")), {target: {value: "mfs"}});
        fireEvent.click(screen.getByLabelText(testT("spouseItemizesDeductionsLabel")));
        fireEvent.change(screen.getByLabelText(testT("agiLabel")), {target: {value: "20000"}});
        fireEvent.change(
            screen.getByLabelText(testT("studentOptionalTaxableScholarshipsLabel")),
            {target: {value: "1000"}},
        );

        const baselineNoItemized = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(baselineNoItemized).toBeDefined();

        // Add pre-floor medical expenses (7.5% of $20,000 = $1,500 floor; $3,500 -> $2,000 deduction)
        // and SALT ($2,000), lowering tax below the no-itemized baseline.
        fireEvent.change(screen.getByLabelText(testT("medicalExpensesLabel")), {target: {value: "3500"}});
        fireEvent.change(screen.getByLabelText(testT("saltLabel")), {target: {value: "2000"}});

        const withItemized = onExpenseCostsChange.mock.calls.at(-1)?.[0] as
            | Array<{ qualifiedExpenses: number; cost: number }>
            | undefined;
        expect(withItemized).toBeDefined();
        expect(withItemized![0].cost).toBeLessThan(baselineNoItemized![0].cost);
        expect(withItemized![1000].cost).toBeGreaterThan(withItemized![0].cost);
    });
});

type NumericLineFieldSpec = {
    lineKey: string;
    pigLatinLabel: string;
    pigLatinTooltip?: string;
    required?: boolean;
    allowNegative?: boolean;
};

const NUMERIC_LINE_FIELDS: readonly NumericLineFieldSpec[] = [
    {
        lineKey: "agi",
        pigLatinLabel: "AGI-ay",
        pigLatinTooltip: "Ormfay 1040 inelay",
        required: true,
    },
    {
        lineKey: "earnedIncome",
        pigLatinLabel: "Earnedyay incomeyay (excludingyay olarshipsschay otnay eportedray onyay Way-2)",
        pigLatinTooltip: "Asyay efinedday ybay ethay Andardstay Eductionday Orksheetway orfay Ependentsday, utbay excludingyay olarshipsschay otnay eportedray onyay Way-2",
    },
    {
        lineKey: "ltcg",
        pigLatinLabel: "Onglay-ermtay apitalcay ainsgay",
        pigLatinTooltip: "Ormfay 1040 inelay 7a",
        allowNegative: true,
    },
    {
        lineKey: "studentMinimumTaxableScholarships",
        pigLatinLabel: "Axabletay olarshipsschay otnay eportedray onyay Way-2",
        pigLatinTooltip: "Alreadyyay-axabletay olarshipschay incomeyay, excludingyay atthay eportedray onyay Way-2, eforebay iftingshay anyyay axtay-eefray olarshipsschay",
    },
    {
        lineKey: "studentMinimumEducationExpenses",
        pigLatinLabel: "Ualifiedqay educationyay expensesyay",
        pigLatinTooltip: "Otnay overedcay ybay axtay-eefray olarshipsschay eforebay iftingshay anyyay axtay-eefray olarshipsschay",
    },
    {
        lineKey: "studentOptionalTaxableScholarships",
        pigLatinLabel: "Iftableshay axtay-eefray olarshipsschay",
        pigLatinTooltip: "Aximummay axtay-eefray olarshipsschay ichwhay ancay ebay appliedyay otay ualifiedqay educationyay expensesyay",
    },
    {
        lineKey: "cashGiftsToPublicCharities",
        pigLatinLabel: "Ashcay iftsgay otay ublicpay aritieschay",
    },
    {
        lineKey: "otherCharitableContributions",
        pigLatinLabel: "Otheryay aritablechay ontributionscay",
    },
    {
        lineKey: "medicalExpenses",
        pigLatinLabel: "Edicalmay andyay entalday expensesyay",
        pigLatinTooltip: "Eduleschay A inelay 1",
    },
    {
        lineKey: "salt",
        pigLatinLabel: "Atestay andyay ocallay axestay",
        pigLatinTooltip: "Eduleschay A inelay 5d",
    },
];

describe("StudentSection numeric line fields", () => {
    it.each(NUMERIC_LINE_FIELDS)(
        "renders $lineKey with required=$required and localized label/tooltip",
        ({lineKey, pigLatinLabel, pigLatinTooltip, required = false}) => {
            const pig = makePigLatinTranslator();
            const labelKey = `${lineKey}Label` as Parameters<Translator>[0];
            const {container} = render(
                <StudentSection
                    {...DEFAULT_PROPS}
                    studentNumber={1}
                    hidden={false}
                    onNameChange={vi.fn()}
                    t={pig}
                />,
            );

            const input = screen.getByLabelText(pigLatinLabel);
            expect(input).toBeInTheDocument();
            expect(pig(labelKey)).toBe(pigLatinLabel);

            const row = input.closest("div")!;
            const asterisk = row.querySelector(".required-indicator");
            if (required) {
                expect(asterisk).not.toBeNull();
                expect(asterisk).toHaveTextContent("*");
                expect(asterisk).toHaveAttribute("aria-hidden", "true");
            } else {
                expect(asterisk).toBeNull();
            }

            const triggerLabel = pig("helpTooltipDefaultTriggerLabel");
            const tooltipButton = tryGetTooltipButtonForInput(container, input, triggerLabel);

            if (pigLatinTooltip) {
                if (tooltipButton === undefined) {
                    throw new Error(`Missing tooltip button "${triggerLabel}" within surrounding div`);
                }
                fireEvent.focus(tooltipButton);
                const tooltip = screen.getByRole("tooltip");
                expect(tooltip).toHaveTextContent(pigLatinTooltip);
            } else {
                expect(tooltipButton).toBeUndefined();
            }
        },
    );

    it.each(NUMERIC_LINE_FIELDS)(
        "validates $lineKey on blur (required=$required) and formats values (allowNegative=$allowNegative)",
        ({lineKey, required = false, allowNegative = false}) => {
            const labelKey = `${lineKey}Label` as Parameters<Translator>[0];
            render(
                <StudentSection
                    {...DEFAULT_PROPS}
                    studentNumber={1}
                    hidden={false}
                    onNameChange={vi.fn()}
                    t={testT}
                />,
            );

            const input = screen.getByLabelText(testT(labelKey));
            expect(input).toHaveValue("");
            expect(input).not.toHaveAttribute("aria-invalid", "true");
            expect(screen.queryByRole("alert")).toBeNull();

            fireEvent.blur(input);
            if (required) {
                expect(input).toHaveAttribute("aria-invalid", "true");
                expect(screen.getByRole("alert")).toHaveTextContent(testT("valueIsRequired"));
            } else {
                expect(input).not.toHaveAttribute("aria-invalid", "true");
                expect(screen.queryByRole("alert")).toBeNull();
            }

            fireEvent.change(input, {target: {value: "4200"}});
            expect(input).toHaveValue("4,200");
            expect(input).not.toHaveAttribute("aria-invalid", "true");
            expect(screen.queryByRole("alert")).toBeNull();

            if (allowNegative) {
                fireEvent.change(input, {target: {value: "-1500"}});
                expect(input).toHaveValue("-1,500");
            }
        },
    );

    it.each(NUMERIC_LINE_FIELDS)(
        "defaults $lineKey to empty and updates independently of other numeric line fields",
        ({lineKey}) => {
            const labelKey = `${lineKey}Label` as Parameters<Translator>[0];
            render(
                <StudentSection
                    {...DEFAULT_PROPS}
                    studentNumber={1}
                    hidden={false}
                    onNameChange={vi.fn()}
                    t={testT}
                />,
            );

            const targetInput = screen.getByLabelText(testT(labelKey));
            const otherInputs = NUMERIC_LINE_FIELDS
                .filter((field) => field.lineKey !== lineKey)
                .map((field) =>
                    screen.getByLabelText(
                        testT(`${field.lineKey}Label` as Parameters<Translator>[0]),
                    ),
                );

            expect(targetInput).toHaveValue("");
            otherInputs.forEach((input) => {
                expect(input).toHaveValue("");
            });

            fireEvent.change(targetInput, {target: {value: "2500"}});
            expect(targetInput).toHaveValue("2,500");
            otherInputs.forEach((input) => {
                expect(input).toHaveValue("");
            });

            fireEvent.change(targetInput, {target: {value: ""}});
            expect(targetInput).toHaveValue("");
            otherInputs.forEach((input) => {
                expect(input).toHaveValue("");
            });
        },
    );
});
