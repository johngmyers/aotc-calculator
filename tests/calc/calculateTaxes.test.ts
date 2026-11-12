import {describe, expect, it} from 'vitest';
// @ts-ignore
import {calculateTaxes, TaxRules} from '../../src/calc/calculateTaxes';

describe('calculateTaxes - Cumulative Thresholds', () => {
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