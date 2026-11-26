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
        const lineRefs = [
            {kind: "form" as const, form: "1040", line: "11"},
            {kind: "schedule" as const, form: "B", line: "33"},
        ];

        render(<HelpTooltip t={pig} lineRefs={lineRefs}/>);
        const button = screen.getByRole("button");
        expect(button).toHaveAccessibleName(pig("helpTooltipDefaultTriggerLabel"));

        fireEvent.focus(button);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Ormfay 1040 inelay 11;Eduleschay B inelay 33");
    });

    it("formats schedule line references with localized kind label and closes on Escape", () => {
        const pig = makePigLatinTranslator();
        const lineRefs = [
            {kind: "form" as const, form: "1040", line: "11"},
            {kind: "schedule" as const, form: "B", line: "33"},
        ];

        render(<HelpTooltip t={pig} lineRefs={lineRefs}/>);
        const button = screen.getByRole("button");

        fireEvent.mouseEnter(button);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveTextContent("Ormfay 1040 inelay 11;Eduleschay B inelay 33");

        fireEvent.keyDown(button, {key: "Escape"});
        expect(screen.queryByRole("tooltip")).toBeNull();
    });
});
