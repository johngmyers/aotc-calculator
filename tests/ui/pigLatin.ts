import {
    createTranslator,
    EN_US_BUNDLE,
    type MessageBundle,
    type MessageKey,
    type Translator,
} from "../../src/ui/i18n.js";

function toPigLatinWord(word: string): string {
    if (/^[0-9/-]+$/.test(word)) return word;
    if (/^[A-Z]{2,}$/.test(word)) return `${word}-ay`;
    const match = word.match(/^([^A-Za-z]*)([A-Za-z]+)(.*)$/);
    if (!match) return word;

    const [, leading, letters, trailing] = match;
    const isCapitalized = /^[A-Z]/.test(letters);
    const lower = letters.toLowerCase();
    const vowelMatch = lower.match(/^([^aeiouy]*)(.*)$/);
    const prefix = vowelMatch?.[1] ?? "";
    const rest = vowelMatch?.[2] ?? lower;

    const pig = prefix.length === 0 ? `${lower}yay` : `${rest}${prefix}ay`;
    const cased = isCapitalized ? pig[0].toUpperCase() + pig.slice(1) : pig;

    return `${leading}${cased}${trailing}`;
}

export function pseudoLocalizeText(template: string): string {
    return template
        .split(/(\{[a-zA-Z0-9_]+\})/g)
        .map((segment) =>
            /^\{[a-zA-Z0-9_]+\}$/.test(segment)
                ? segment
                : segment.replace(/\b[A-Za-z]+\b/g, toPigLatinWord),
        )
        .join("");
}

export function pseudoLocalizeHtml(template: string): string {
    return template
        .split(/(<[^>]+>|\{[a-zA-Z0-9_]+\})/g)
        .map((segment) =>
            /^(<[^>]+>|\{[a-zA-Z0-9_]+\})$/.test(segment)
                ? segment
                : segment.replace(/\b[A-Za-z]+\b/g, toPigLatinWord),
        )
        .join("");
}

export function createPigLatinBundle(
    source: MessageBundle = EN_US_BUNDLE,
    options?: { preserveHtmlTags?: boolean },
): MessageBundle {
    const transform = options?.preserveHtmlTags
        ? pseudoLocalizeHtml
        : pseudoLocalizeText;
    const entries = Object.keys(source).map((key) => [
        key,
        transform(source[key as MessageKey]),
    ]);
    return {
        ...(Object.fromEntries(entries) as MessageBundle),
        federalLineListSeparator: ";",
    } as MessageBundle;
}

export function makePigLatinTranslator(
    source: MessageBundle = EN_US_BUNDLE,
    options?: { preserveHtmlTags?: boolean },
): Translator {
    return createTranslator(createPigLatinBundle(source, options));
}
