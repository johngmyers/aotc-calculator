import {describe, expect, it} from 'vitest';
// @ts-ignore
import {calculateAotc, FederalTaxRules} from "../../src/calc/calculateAotc";

describe("calculateAotc", () => {
    const rules: FederalTaxRules = {
        brackets: [],
        aotc: {
            firstTierCap: 2000,
            secondTierCap: 4000,
            secondTierRate: 0.25,
            phaseoutStart: 80000,
            phaseoutRange: 10000,
            refundableRate: 0.4,
        },
    };

    it("handles single student at 0", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 0}],
        });
        expect(res).toEqual({nonrefundableCredit: 0, refundableCredit: 0});
    });

    it("handles single student at 1000", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 1000}],
        });
        expect(res).toEqual({nonrefundableCredit: 600, refundableCredit: 400});
    });

    it("handles single student at 3000", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 3000}],
        });
        expect(res).toEqual({nonrefundableCredit: 1350, refundableCredit: 900});
    });

    it("caps single student at 5000", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 5000}],
        });
        expect(res).toEqual({nonrefundableCredit: 1500, refundableCredit: 1000});
    });

    it("rounds single student at 50 cents before refundable split", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 2002.5}],
        });
        expect(res).toEqual({nonrefundableCredit: 1201, refundableCredit: 800});
    });

    it("rounds each student before combining for two students", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 2002.5}, {qualifiedExpenses: 2001.5}],
        });
        expect(res).toEqual({nonrefundableCredit: 2401, refundableCredit: 1600});
    });

    it("leaves excess credit after rounding refundable split in nonrefundable", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 2002.5}],
        });
        expect(res.refundableCredit + res.nonrefundableCredit).toBe(2001);
        expect(res.refundableCredit).toBe(800);
        expect(res.nonrefundableCredit).toBe(1201);
    });

    it("handles two students: A 1000, B 3000", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 1000}, {qualifiedExpenses: 3000}],
        });
        expect(res).toEqual({nonrefundableCredit: 1950, refundableCredit: 1300});
    });

    it("handles two students: A 3000, B 6000", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            students: [{qualifiedExpenses: 3000}, {qualifiedExpenses: 6000}],
        });
        expect(res).toEqual({nonrefundableCredit: 2850, refundableCredit: 1900});
    });

    it("blocks refundable credit when refundableIneligible is true", () => {
        const res = calculateAotc(rules, {
            agi: 0,
            refundableIneligible: true,
            students: [{qualifiedExpenses: 5000}],
        });
        expect(res).toEqual({nonrefundableCredit: 2500, refundableCredit: 0});
    });
});