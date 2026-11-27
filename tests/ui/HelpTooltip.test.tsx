import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import {EN_US_BUNDLE, type MessageBundle, type MessageKey,} from "../../src/ui/i18n.js";
import {HelpTooltip} from "../../src/ui/HelpTooltip.js";
import {makePigLatinTranslator} from "./pigLatin.js";

afterEach(() => {
    cleanup();
});

describe("HelpTooltip", () => {
    it("falls back to localized helpTooltipDefaultTriggerLabel when {textKey}Label is absent", () => {
        const pig = makePigLatinTranslator();
        const keyWithoutLabel = Object.keys(EN_US_BUNDLE).find(
            (k) => !(`${k}Label` in EN_US_BUNDLE) && k !== "helpTooltipDefaultTriggerLabel",
        ) as MessageKey;

        render(<HelpTooltip t={pig} textKey={keyWithoutLabel}/>);
        const button = screen.getByRole("button");
        const expectedFallback = pig("helpTooltipDefaultTriggerLabel");

        expect(button).toHaveAccessibleName(expectedFallback);
        expect(expectedFallback).not.toBe("More information");
    });

    it("uses localized {textKey}Label when present in the bundle", () => {
        const targetKey = "stayWithinVitaScopeTooltip" as MessageKey;
        const bundleWithLabel = {
            ...EN_US_BUNDLE,
            [`${targetKey}Label`]: "Custom scope help label",
        } as MessageBundle;
        const pig = makePigLatinTranslator(bundleWithLabel);

        render(<HelpTooltip t={pig} textKey={targetKey}/>);
        const button = screen.getByRole("button");
        const expectedLabel = pig.try(`${targetKey}Label`)!;

        expect(expectedLabel).toBeDefined();
        expect(expectedLabel).not.toBe("Custom scope help label");
        expect(button).toHaveAccessibleName(expectedLabel);
    });

    it("renders pseudo-localized text on focus/hover and closes on Escape", () => {
        const pig = makePigLatinTranslator();
        const key = "stayWithinVitaScopeTooltip" as MessageKey;

        render(<HelpTooltip t={pig} textKey={key}/>);
        const button = screen.getByRole("button");

        expect(screen.queryByRole("tooltip")).toBeNull();

        fireEvent.focus(button);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent(pig(key));
        expect(button).toHaveAttribute("aria-describedby", tooltip.id);

        fireEvent.keyDown(button, {key: "Escape"});
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("formats form line references with localized kind label", () => {
        const pig = makePigLatinTranslator();
        const lineRefs = {
            refs: [
                {kind: "form" as const, form: "1040", line: "11"},
                {kind: "schedule" as const, form: "B", line: "33"},
            ]
        };

        render(<HelpTooltip t={pig} lineRefs={lineRefs}/>);
        const button = screen.getByRole("button");
        expect(button).toHaveAccessibleName(pig("helpTooltipDefaultTriggerLabel"));

        fireEvent.focus(button);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Ormfay 1040 inelay 11;Eduleschay B inelay 33");
    });

    it("formats schedule line references with localized kind label and closes on Escape", () => {
        const pig = makePigLatinTranslator();
        const lineRefs = {
            refs: [
                {kind: "form" as const, form: "1040", line: "11"},
                {kind: "schedule" as const, form: "B", line: "33"},
            ],
        };

        render(<HelpTooltip t={pig} lineRefs={lineRefs}/>);
        const button = screen.getByRole("button");

        fireEvent.mouseEnter(button);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Ormfay 1040 inelay 11;Eduleschay B inelay 33");

        fireEvent.keyDown(button, {key: "Escape"});
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("joins additive line references with federalLineAdditiveSeparator", () => {
        const pig = makePigLatinTranslator();
        const lineRefs = {
            additive: true,
            refs: [
                {kind: "schedule" as const, form: "A", line: "10"},
                {kind: "schedule" as const, form: "A", line: "15"},
                {kind: "schedule" as const, form: "A", line: "16"},
            ],
        };

        render(<HelpTooltip t={pig} lineRefs={lineRefs}/>);
        fireEvent.focus(screen.getByRole("button"));

        const expected = lineRefs.refs
            .map((ref) =>
                pig("federalLineReference", {
                    refKind: pig("federalLineKindSchedule"),
                    refForm: ref.form,
                    refLine: ref.line,
                }),
            )
            .join(pig("federalLineAdditiveSeparator"));

        expect(screen.getByRole("tooltip")).toHaveTextContent(expected);
    });

    it("forwards interpolation vars when rendering textKey tooltips", () => {
        const pig = makePigLatinTranslator();

        render(<HelpTooltip t={pig} textKey="studentSectionTitle" vars={{number: 3}}/>);
        fireEvent.focus(screen.getByRole("button"));

        expect(screen.getByRole("tooltip")).toHaveTextContent(
            pig("studentSectionTitle", {number: 3}),
        );
    });

    it("closes tooltip on mouseLeave and blur", () => {
        const pig = makePigLatinTranslator();
        const {container} = render(<HelpTooltip t={pig} textKey="stayWithinVitaScopeTooltip"/>);
        const wrapper = container.querySelector(".help-tooltip")!;
        const button = screen.getByRole("button");

        fireEvent.mouseEnter(wrapper);
        expect(screen.getByRole("tooltip")).toBeInTheDocument();

        fireEvent.mouseLeave(wrapper);
        expect(screen.queryByRole("tooltip")).toBeNull();

        fireEvent.focus(button);
        expect(screen.getByRole("tooltip")).toBeInTheDocument();

        fireEvent.blur(button);
        expect(screen.queryByRole("tooltip")).toBeNull();
    });
})

