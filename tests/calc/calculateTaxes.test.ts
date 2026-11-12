import {describe, expect, it} from 'vitest';
// @ts-ignore
import {calculateTaxes, GrossIncome, TaxRules} from '../../src/calc/calculateTaxes';

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

describe('calculateTaxes - Dependent Standard Deduction Rules', () => {
    // Dependent student rules: basic cap = $16,100, base = $1,350, earnedAddOn = $450
    const dependentRules: TaxRules = {
        standardDeduction: 16100, // Acts as the maximum cap for a dependent
        dependentStandardDeduction: {
            base: 1350,
            earnedAddOn: 450,
        },
        brackets: [
            {until: 11925, rate: 0.10},
            {until: 48475, rate: 0.12},
            {until: Infinity, rate: 0.22},
        ]
    };

    it('applies the dependent baseline floor when earned income is zero or very low', () => {
        const inputs: GrossIncome = {
            agi: 5000,
            claimedAsDependent: true,
            earnedIncome: 200,
        };
        // Dependent SD = max(1350, 200 + 450) = max(1350, 650) = $1,350 baseline floor
        // Taxable income = $5,000 - $1,350 = $3,650
        const result = calculateTaxes(dependentRules, inputs);
        expect(result.taxableIncome).toBe(3650);
    });

    it('scales the dependent standard deduction up with earned income plus add-on', () => {
        const inputs: GrossIncome = {
            agi: 8000,
            claimedAsDependent: true,
            earnedIncome: 4000,
        };
        // Dependent SD = max(1350, 4000 + 450) = max(1350, 4450) = $4,450
        // Taxable income = $8,000 - $4,450 = $3,550
        const result = calculateTaxes(dependentRules, inputs);
        expect(result.taxableIncome).toBe(3550);
    });

    it('caps the dependent standard deduction at the basic standard deduction limit', () => {
        const inputs: GrossIncome = {
            agi: 25000,
            claimedAsDependent: true,
            earnedIncome: 18000, // High summer job earnings
        };
        // Uncapped calculation would be 18000 + 450 = 18450, but capped at non-dependent SD ($16,100)
        // Taxable income = $25,000 - $16,100 = $8,900
        const result = calculateTaxes(dependentRules, inputs);
        expect(result.taxableIncome).toBe(8900);
    });

    it('defaults earnedIncome to 0 when omitted for a dependent, applying the base minimum floor', () => {
        const inputs: GrossIncome = {
            agi: 5000,
            claimedAsDependent: true,
            // earnedIncome is intentionally omitted / undefined
        };

        // Dependent SD = max(1350, (undefined ?? 0) + 450) = max(1350, 450) = $1,350 baseline floor
        // Taxable income = $5,000 - $1,350 = $3,650
        const result = calculateTaxes(dependentRules, inputs);
        expect(result.taxableIncome).toBe(3650);
    });

    it('handles a dependent with taxable scholarships as earned income for standard deduction', () => {
        // Under IRS rules, taxable scholarships/fellowships are treated as earned income specifically
        // for calculating the dependent standard deduction add-on ($450).
        const inputs: GrossIncome = {
            agi: 5500,
            claimedAsDependent: true,
            earnedIncome: 1000,
            taxableScholarships: 2000,
        };

        // Total earned equivalent for dependent SD = $1,000 earned + $2,000 scholarship = $3,000
        // Dependent SD = max(1350, 3000 + 450) = max(1350, 3450) = $3,450
        // Taxable income = $5,500 AGI - $3,450 SD = $2,050
        const result = calculateTaxes(dependentRules, inputs);
        expect(result.taxableIncome).toBe(2050);
    });

    it('disallows the standard deduction for a dependent when mustItemize is true', () => {
        const inputs: GrossIncome = {
            agi: 5000,
            claimedAsDependent: true,
            earnedIncome: 2000,
            mustItemize: true, // Forces dependent standard deduction to $0
        };
        // Since mustItemize is true, dependent SD rules are bypassed and standard deduction = $0.
        // Taxable income = $5,000 - $0 = $5,000.
        // - $5,000 @ 10% = $500.00 tax.
        const result = calculateTaxes(dependentRules, inputs);
        expect(result.taxableIncome).toBe(5000);
        expect(result.tax).toBe(500);
    });
});
