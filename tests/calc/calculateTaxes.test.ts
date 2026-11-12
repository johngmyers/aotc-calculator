import {describe, expect, it} from 'vitest';
// @ts-ignore
import {calculateTaxes, TaxRules} from '../../src/calc/calculateTaxes';

describe('calculateTaxes - brackets', () => {
    const cumulativeRules: TaxRules = {
        brackets: [
            {until: 10000, rate: 0.10},   // $0 – $10,000 ($10k width)
            {until: 40000, rate: 0.12},   // $10,000 – $40,000 ($30k width)
            {until: Infinity, rate: 0.22} // Over $40,000
        ]
    };

    it('returns 0 tax for zero or negative AGI', () => {
        expect(calculateTaxes(cumulativeRules, {agi: 0})).toEqual({taxableIncome: 0, tax: 0});
        expect(calculateTaxes(cumulativeRules, {agi: -1000})).toEqual({taxableIncome: 0, tax: 0});
    });

    it('calculates tax within the first bracket', () => {
        // $6,000 * 10% = $600
        const result = calculateTaxes(cumulativeRules, {agi: 6000});
        expect(result.taxableIncome).toBe(6000);
        expect(result.tax).toBe(600);
    });

    it('calculates tax exactly on a bracket boundary', () => {
        // $10,000 * 10% = $1,000
        const result = calculateTaxes(cumulativeRules, {agi: 10000});
        expect(result.tax).toBe(1000);
    });

    it('slices income accurately across three cumulative brackets', () => {
        // AGI = $45,000:
        // - Bracket 1 ($0 to $10k -> $10,000) @ 10% = $1,000
        // - Bracket 2 ($10k to $40k -> $30,000) @ 12% = $3,600
        // - Bracket 3 ($40k to $45k -> $5,000) @ 22% = $1,100
        // Total = $5,700 (would have been $5,200 if Bracket 2 took $35,000)
        const result = calculateTaxes(cumulativeRules, {agi: 45000});
        expect(result.taxableIncome).toBe(45000);
        expect(result.tax).toBe(5700);
    });

    it('rounds fractional cents cleanly', () => {
        const fractionalRules: TaxRules = {
            brackets: [{until: Infinity, rate: 0.10555}]
        };
        // $100 * 0.10555 = 10.555 -> 10.56
        expect(calculateTaxes(fractionalRules, {agi: 100}).tax).toBe(10.56);
    });
});

describe('calculateTaxes - standardDeduction', () => {
    const rulesWithDeduction: TaxRules = {
        standardDeduction: 16100, // 2026 Single basic standard deduction
        brackets: [
            {until: 10000, rate: 0.10},
            {until: 40000, rate: 0.12},
            {until: Infinity, rate: 0.22},
        ],
    };

    it('reduces taxableIncome to 0 and owes 0 tax when AGI is less than standardDeduction', () => {
        const result = calculateTaxes(rulesWithDeduction, {agi: 12000});
        expect(result.taxableIncome).toBe(0);
        expect(result.tax).toBe(0);
    });

    it('reduces taxableIncome to 0 and owes 0 tax when AGI equals standardDeduction', () => {
        const result = calculateTaxes(rulesWithDeduction, {agi: 16100});
        expect(result.taxableIncome).toBe(0);
        expect(result.tax).toBe(0);
    });

    it('does not produce negative taxableIncome when AGI is 0 or negative', () => {
        expect(calculateTaxes(rulesWithDeduction, {agi: 0})).toEqual({
            taxableIncome: 0,
            tax: 0,
        });
        expect(calculateTaxes(rulesWithDeduction, {agi: -2500})).toEqual({
            taxableIncome: 0,
            tax: 0,
        });
    });

    it('applies brackets to post-deduction taxableIncome rather than gross AGI', () => {
        // AGI = $21,100 -> taxableIncome = $21,100 - $16,100 = $5,000
        // All $5,000 sits in the 10% bracket -> $500 tax
        const result = calculateTaxes(rulesWithDeduction, {agi: 21100});
        expect(result.taxableIncome).toBe(5000);
        expect(result.tax).toBe(500);
    });

    it('aligns bracket boundaries with post-deduction taxableIncome', () => {
        // AGI = $26,100 -> taxableIncome = $10,000 (exact top of 10% bracket) -> $1,000 tax
        const atBoundary = calculateTaxes(rulesWithDeduction, {agi: 26100});
        expect(atBoundary.taxableIncome).toBe(10000);
        expect(atBoundary.tax).toBe(1000);

        // AGI = $26,101 -> taxableIncome = $10,001 ($1 spills into 12% bracket) -> $1,000.12 tax
        const overBoundary = calculateTaxes(rulesWithDeduction, {agi: 26101});
        expect(overBoundary.taxableIncome).toBe(10001);
        expect(overBoundary.tax).toBe(1000.12);
    });

    it('slices multi-bracket income accurately after subtracting standardDeduction', () => {
        // AGI = $61,100 -> taxableIncome = $61,100 - $16,100 = $45,000
        // - $10,000 @ 10% = $1,000
        // - $30,000 @ 12% = $3,600
        // -  $5,000 @ 22% = $1,100
        // Total = $5,700
        const result = calculateTaxes(rulesWithDeduction, {agi: 61100});
        expect(result.taxableIncome).toBe(45000);
        expect(result.tax).toBe(5700);
    });

    it('behaves identically to prior behavior when standardDeduction is explicitly 0', () => {
        const zeroDeductionRules: TaxRules = {
            ...rulesWithDeduction,
            standardDeduction: 0,
        };
        const result = calculateTaxes(zeroDeductionRules, {agi: 45000});
        expect(result.taxableIncome).toBe(45000);
        expect(result.tax).toBe(5700);
    });

    it('disallows the standard deduction when mustItemize is true', () => {
        // AGI = $21,100
        // With mustItemize: standard deduction is treated as 0, so taxableIncome = $21,100
        // - $10,000 @ 10% = $1,000
        // - $11,100 @ 12% = $1,332
        // Total Tax = $2,332
        const mustItemizeResult = calculateTaxes(rulesWithDeduction, {
            agi: 21100,
            mustItemize: true,
        });
        expect(mustItemizeResult.taxableIncome).toBe(21100);
        expect(mustItemizeResult.tax).toBe(2332);
    });
});
