import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {StudentSection} from "../../src/ui/StudentSection.js";
import {getTranslator, Translator} from "../../src/ui/i18n.js";

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

    it("respects the hidden prop on section and input", () => {
        render(
            <StudentSection
                studentNumber={1}
                hidden={true}
                onNameChange={vi.fn()}
                t={testT}
            />,
        );

        expect(screen.getByRole("heading", {
            name: "Student 1",
            hidden: true
        }).closest("section")).toHaveAttribute("hidden");
        expect(screen.getByLabelText("Name")).toHaveAttribute("hidden");
    });
});
