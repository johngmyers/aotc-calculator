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

    it("applies no reduction at phaseoutStart", () => {
        // student @ 3000 -> tentativeCredit = 2250 -> refundable 900, nonrefundable 1350
        const res = calculateAotc(rules, {
            agi: 80000,
            students: [{qualifiedExpenses: 3000}],
        });
        expect(res).toEqual({nonrefundableCredit: 1350, refundableCredit: 900});
    });

    it("halves credit at mid-range", () => {
        // student @ 4000 -> tentativeCredit = 2500; agi = 85000 (50% kept) -> phasedCredit = 1250
        // refundable = round(1250 * 0.4) = 500; nonrefundable = 750
        const res = calculateAotc(rules, {
            agi: 85000,
            students: [{qualifiedExpenses: 4000}],
        });
        expect(res).toEqual({nonrefundableCredit: 750, refundableCredit: 500});
    });

    it("rounds mid-range phased credit", () => {
        // student @ 1001 (< 2000) -> tentativeCredit = 1001; agi = 85000 (50% kept) -> 500.5 -> round = 501
        // refundable = round(501 * 0.4) = round(200.4) = 200; nonrefundable = 501 - 200 = 301
        const res = calculateAotc(rules, {
            agi: 85000,
            students: [{qualifiedExpenses: 1001}],
        });
        expect(res).toEqual({nonrefundableCredit: 301, refundableCredit: 200});
    });

    it("zeroes credit at or above end of phaseout range", () => {
        const res = calculateAotc(rules, {
            agi: 90000,
            students: [{qualifiedExpenses: 4000}],
        });
        expect(res).toEqual({nonrefundableCredit: 0, refundableCredit: 0});
    });

    it("sums combined credit before rounding when both students phase out to x.25", () => {
        // Each student @ 2004 whole dollars -> 2000 + round(4 * 0.25) = 2001 tentative credit.
        // At agi = 87500 (25% kept), each student is 500.25; combined is 1000.50 -> rounds to 1001
        // (whereas rounding each 500.25 before summing would give 500 + 500 = 1000).
        // Refundable = round(1001 * 0.4) = round(400.4) = 400; nonrefundable = 1001 - 400 = 601.
        const res = calculateAotc(rules, {
            agi: 87500,
            students: [{qualifiedExpenses: 2004}, {qualifiedExpenses: 2004}],
        });
        expect(res).toEqual({nonrefundableCredit: 601, refundableCredit: 400});
    });
});