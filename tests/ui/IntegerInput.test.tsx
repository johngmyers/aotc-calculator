import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import {useState} from "react";
import {IntegerInput, type IntegerValidator, valueRequired,} from "../../src/ui/IntegerInput.js";
import {createTranslator, EN_US_BUNDLE, type MessageBundle} from "../../src/ui/i18n.js";
import {makePigLatinTranslator} from "./pigLatin.js";

const TEST_BUNDLE = {
    ...EN_US_BUNDLE,
    valueIsRequired: "This field is required.",
    cannotBeGreaterThanAgi: "Cannot exceed AGI ({agi}).",
} as unknown as MessageBundle;

afterEach(() => {
    cleanup();
});

describe("IntegerInput validation", () => {
    it("disallows negative values by default and allows them when allowNegative is true", () => {
        function Harness() {
            const [val, setVal] = useState<number | undefined>(undefined);
            const [allowNeg, setAllowNeg] = useState(false);
            const t = createTranslator(TEST_BUNDLE);
            return (
                <>
                    <button type="button" onClick={() => setAllowNeg(true)}>
                        Allow negative
                    </button>
                    <IntegerInput
                        aria-label="Amount"
                        t={t}
                        value={val}
                        onValueChange={setVal}
                        allowNegative={allowNeg}
                    />
                </>
            );
        }

        render(<Harness/>);
        const input = screen.getByRole("textbox", {name: "Amount"});

        fireEvent.change(input, {target: {value: "-500"}});
        expect(input).toHaveValue("500");

        fireEvent.click(screen.getByRole("button", {name: "Allow negative"}));
        fireEvent.change(input, {target: {value: "-500"}});
        expect(input).toHaveValue("-500");
    });

    it("does not validate or show error before first blur", () => {
        const t = createTranslator(TEST_BUNDLE);
        render(
            <IntegerInput
                aria-label="Claimant AGI"
                t={t}
                validator={valueRequired}
            />,
        );

        const input = screen.getByRole("textbox", {name: "Claimant AGI"});
        expect(input).toHaveValue("");
        expect(input).not.toHaveAttribute("aria-invalid", "true");
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows required message and error styling on blur when empty, then clears on valid entry", () => {
        function Harness() {
            const [val, setVal] = useState<number | undefined>(undefined);
            const t = createTranslator(TEST_BUNDLE);
            return (
                <IntegerInput
                    aria-label="Claimant AGI"
                    t={t}
                    value={val}
                    onValueChange={setVal}
                    validator={valueRequired}
                />
            );
        }

        render(<Harness/>);
        const input = screen.getByRole("textbox", {name: "Claimant AGI"});
        fireEvent.blur(input);

        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input.className).toMatch(/error|invalid/i);
        expect(screen.getByRole("alert")).toHaveTextContent("This field is required.");

        fireEvent.change(input, {target: {value: "0"}});
        expect(input).toHaveValue("0");
        expect(input).not.toHaveAttribute("aria-invalid", "true");
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("localizes validation messages and interpolates vars", () => {
        const cannotExceedAgi: IntegerValidator = (val) =>
            val !== undefined && val > 10000
                ? "cannotBeGreaterThanAgi"
                : undefined;

        const pigBundle = makePigLatinTranslator(TEST_BUNDLE);
        render(
            <IntegerInput
                aria-label="Qualified expenses"
                t={pigBundle}
                value={12000}
                validator={cannotExceedAgi}
                vars={{agi: 10000}}
            />,
        );

        const input = screen.getByRole("textbox", {name: "Qualified expenses"});
        fireEvent.blur(input);

        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent(
            pigBundle("cannotBeGreaterThanAgi", {agi: 10000}),
        );
    });

    it("re-validates after blur when vars (such as AGI) change", () => {
        function Harness() {
            const [agi, setAgi] = useState<number | undefined>(5000);
            const [expenses, setExpenses] = useState<number | undefined>(8000);
            const t = createTranslator(TEST_BUNDLE);
            const cannotExceedAgi: IntegerValidator = (val) =>
                val !== undefined && agi !== undefined && val > agi
                    ? "cannotBeGreaterThanAgi"
                    : undefined;

            return (
                <>
                    <button type="button" onClick={() => setAgi(10000)}>
                        Raise AGI
                    </button>
                    <IntegerInput
                        aria-label="Qualified expenses"
                        t={t}
                        value={expenses}
                        onValueChange={setExpenses}
                        validator={cannotExceedAgi}
                        vars={{agi}}
                    />
                </>
            );
        }

        render(<Harness/>);
        const input = screen.getByRole("textbox", {name: "Qualified expenses"});

        fireEvent.blur(input);
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent("Cannot exceed AGI (5000).");

        fireEvent.click(screen.getByRole("button", {name: "Raise AGI"}));
        expect(input).not.toHaveAttribute("aria-invalid", "true");
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
