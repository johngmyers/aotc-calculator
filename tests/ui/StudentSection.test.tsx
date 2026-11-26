import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {StudentSection} from "../../src/ui/StudentSection.js";
import {getTranslator, Translator} from "../../src/ui/i18n.js";
import {FILING_STATUS_LABEL_KEYS, FILING_STATUS_ORDER} from "../../src/ui/AotcDependentCalculator.js";
import {makePigLatinTranslator} from "./pigLatin.js";
import {getTooltipButtonForInput} from "./helpers.js";

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
});

type NumericLineFieldSpec = {
    lineKey: string;
    pigLatinLabel: string;
    pigLatinTooltip: string;
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
            const tooltipButton = getTooltipButtonForInput(container, input, triggerLabel);
            fireEvent.focus(tooltipButton);

            const tooltip = screen.getByRole("tooltip");
            expect(tooltip).toHaveTextContent(pigLatinTooltip);
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
