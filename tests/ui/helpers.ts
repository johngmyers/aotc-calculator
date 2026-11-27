import {within} from "@testing-library/react";

export function tryGetTooltipButtonForInput(
    root: HTMLElement,
    input: HTMLElement,
    triggerName: string,
): HTMLElement | undefined {
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

    return undefined;
}

export function getTooltipButtonForInput(
    root: HTMLElement,
    input: HTMLElement,
    triggerName: string,
): HTMLElement {
    const result = tryGetTooltipButtonForInput(root, input, triggerName);

    if (result === undefined) {
        throw new Error(`Missing tooltip button "${triggerName}" within surrounding div`);
    }

    return result;
}
