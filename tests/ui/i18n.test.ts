import {describe, expect, it} from "vitest";
import {
    createTranslator,
    EN_US_BUNDLE,
    getTranslator,
    type MessageKey,
} from "../../src/ui/i18n.js";
import {createPigLatinBundle, pseudoLocalizeText} from "./pigLatin.js";

describe("i18n translator & test-side Pig Latin pseudo-localization", () => {
    it("supports t() for known keys and t.try() for optional/missing keys", () => {
        const t = getTranslator("en-US");
        const firstKey = Object.keys(EN_US_BUNDLE)[0] as MessageKey;

        expect(t.try(firstKey)).toBe(t(firstKey));
        expect(t.try("__does_not_exist__")).toBeUndefined();
    });

    it("translates helpTooltipDefaultTriggerLabel to 'More information' in en-US and transforms it in Pig Latin", () => {
        const en = getTranslator("en-US");
        const pig = createTranslator(createPigLatinBundle(EN_US_BUNDLE));
        const key = "helpTooltipDefaultTriggerLabel" as MessageKey;

        expect(en(key)).toBe("More information");
        expect(pig(key)).not.toBe("More information");
        expect(pig(key)).toContain("ay");
    });

    it("preserves {placeholders} when pseudo-localizing templates", () => {
        const sample = "Line {lineNum} of Form 1040 for {taxYear}";
        const out = pseudoLocalizeText(sample);

        expect(out).toContain("{lineNum}");
        expect(out).toContain("{taxYear}");
        expect(out).toContain("1040");
        expect(out).not.toContain("Line");
    });

    it("works with createTranslator(pigLatinBundle) for both t() and t.try()", () => {
        const en = getTranslator("en-US");
        const pig = createTranslator(createPigLatinBundle(EN_US_BUNDLE));

        for (const rawKey of Object.keys(EN_US_BUNDLE)) {
            const key = rawKey as MessageKey;
            const enVal = en(key);
            const pigVal = pig(key);

            expect(pig.try(key)).toBe(pigVal);
            if (/[A-Za-z]{3,}/.test(enVal)) {
                expect(pigVal).not.toBe(enVal);
            }
        }
    });
});
