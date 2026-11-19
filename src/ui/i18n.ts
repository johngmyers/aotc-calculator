import rawEnUS from "../locales/en-US.yaml";

export type MessageBundle = typeof rawEnUS;
export type MessageKey = Extract<keyof MessageBundle, string>;
export type TranslationVars = Record<string, string | number | undefined>;

export interface Translator {
    (key: MessageKey, vars?: TranslationVars): string;

    try(key: string, vars?: TranslationVars): string | undefined;
}

const MESSAGE_KEYS = Object.keys(rawEnUS) as MessageKey[];

function validateBundle(
    raw: Record<string, unknown>,
    locale: string,
): MessageBundle {
    for (const key of MESSAGE_KEYS) {
        if (typeof raw[key] !== "string") {
            throw new Error(
                `Locale "${locale}" is missing or has non-string message key "${key}"`,
            );
        }
    }
    return raw as MessageBundle;
}

export const EN_US_BUNDLE = validateBundle(rawEnUS, "en-US");

const BUNDLES: Record<string, MessageBundle> = {
    "en-US": EN_US_BUNDLE,
};

function interpolate(template: string, vars?: TranslationVars): string {
    if (!vars) return template;
    let text = template;
    for (const [varName, val] of Object.entries(vars)) {
        if (val !== undefined) {
            text = text.replaceAll(`{${varName}}`, String(val));
        }
    }
    return text;
}

export function createTranslator(
    bundle: MessageBundle = EN_US_BUNDLE,
): Translator {
    const rawRecord = bundle as Record<string, unknown>;

    const t = function t(key: MessageKey, vars?: TranslationVars): string {
        return interpolate(bundle[key], vars);
    } as Translator;

    t.try = function tryKey(
        key: string,
        vars?: TranslationVars,
    ): string | undefined {
        const entry = rawRecord[key];
        if (typeof entry !== "string") return undefined;
        return interpolate(entry, vars);
    };

    return t;
}

export function getTranslator(locale = "en-US"): Translator {
    return createTranslator(BUNDLES[locale] ?? EN_US_BUNDLE);
}
