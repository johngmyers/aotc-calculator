import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {StudentSection} from "../../src/ui/StudentSection.js";
import {getTranslator, Translator} from "../../src/ui/i18n.js";
import {FILING_STATUS_LABEL_KEYS, FILING_STATUS_ORDER} from "../../src/ui/AotcDependentCalculator.js";

const testT: Translator = getTranslator("en-US");

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("StudentSection", () => {
    it("emits default Student {number} name on mount and keeps static heading", () => {
        const onNameChange = vi.fn();

        render(
            <StudentSection
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
});
