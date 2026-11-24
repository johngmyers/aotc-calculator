import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {StudentSection} from "../../src/ui/StudentSection.js";
import {getTranslator, Translator} from "../../src/ui/i18n.js";
import {FILING_STATUS_LABEL_KEYS, FILING_STATUS_ORDER} from "../../src/ui/AotcDependentCalculator.js";

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

    it("defaults scholarship and education expense inputs to empty and updates each independently", () => {
        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const taxableScholarshipsInput = screen.getByLabelText(
            testT("studentMinimumTaxableScholarshipsLabel"),
        );
        const educationExpensesInput = screen.getByLabelText(
            testT("studentMinimumEducationExpensesLabel"),
        );
        const shiftableScholarshipsInput = screen.getByLabelText(
            testT("studentOptionalTaxableScholarshipsLabel"),
        );

        expect(taxableScholarshipsInput).toHaveValue("");
        expect(educationExpensesInput).toHaveValue("");
        expect(shiftableScholarshipsInput).toHaveValue("");

        fireEvent.change(taxableScholarshipsInput, {target: {value: "1,500"}});
        fireEvent.change(educationExpensesInput, {target: {value: "4,200"}});
        fireEvent.change(shiftableScholarshipsInput, {target: {value: "2,500"}});

        expect(taxableScholarshipsInput).toHaveValue("1,500");
        expect(educationExpensesInput).toHaveValue("4,200");
        expect(shiftableScholarshipsInput).toHaveValue("2,500");

        fireEvent.change(educationExpensesInput, {target: {value: ""}});
        expect(taxableScholarshipsInput).toHaveValue("1,500");
        expect(educationExpensesInput).toHaveValue("");
        expect(shiftableScholarshipsInput).toHaveValue("2,500");
    });

    it("renders help tooltips for each scholarship and education expense input", () => {
        render(
            <StudentSection
                {...DEFAULT_PROPS}
                studentNumber={1}
                hidden={false}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        const triggers = screen.getAllByRole("button", {
            name: testT("helpTooltipDefaultTriggerLabel"),
        });
        expect(triggers).toHaveLength(3);
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
