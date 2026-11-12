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

describe('calculateTaxes - Capital Gains Brackets & Income Stacking', () => {
    const stackedRules: TaxRules = {
        standardDeduction: 10000,
        brackets: [
            {until: 10000, rate: 0.10},
            {until: 30000, rate: 0.20},
            {until: Infinity, rate: 0.30},
        ],
        capitalGainsBrackets: [
            {until: 15000, rate: 0.05}, // Non-zero lowest cap gains tier to ensure visibility
            {until: 30000, rate: 0.15},
            {until: Infinity, rate: 0.25},
        ],
    };

    it('applies the non-zero lowest capital gains rate correctly up to the threshold after standard deduction', () => {
        // AGI = $20,000, entirely composed of LTCG ($20,000); ordinary income = $0.
        // Standard Deduction = $10,000 absorbs the $0 ordinary income.
        // Taxable income = $10,000 (all LTCG), falling entirely within the first bracket ($15k width) @ 5%:
        // - $10,000 * 0.05 = $500
        const income: GrossIncome = {
            agi: 20000,
            ltcg: 20000,
        };

        const result = calculateTaxes(stackedRules, income);
        expect(result.taxableIncome).toBe(10000);
        expect(result.tax).toBe(500);
    });

    it('slices capital gains accurately across two non-zero tiers after standard deduction', () => {
        // AGI = $30,000, entirely composed of LTCG ($30,000); ordinary income = $0.
        // Standard Deduction = $10,000 absorbs the $0 ordinary income.
        // Taxable income = $20,000 (all LTCG):
        // - First $15,000 @ 5% = $750
        // - Remaining $5,000 @ 15% = $750
        // Total Tax = $750 + $750 = $1,500
        const income: GrossIncome = {
            agi: 30000,
            ltcg: 30000,
        };

        const result = calculateTaxes(stackedRules, income);
        expect(result.taxableIncome).toBe(20000);
        expect(result.tax).toBe(1500);
    });

    it('correctly stacks ordinary income and capital gains, accounting for ordinary income consuming lower cap gains brackets', () => {
        // Total AGI = $70,000, where:
        // - LTCG = $30,000
        // - Ordinary income before deduction = AGI - ltcg = $70,000 - $30,000 = $40,000
        // Standard Deduction = $10,000.
        // Taxable ordinary income = $40,000 - $10,000 = $30,000 (consumes 2 full ordinary brackets):
        //   - Full Bracket 1 ($0 to $10k -> $10,000) @ 10% = $1,000
        //   - Full Bracket 2 ($10k to $30k -> $20,000) @ 20% = $4,000
        //   Ordinary Tax = $5,000
        //
        // Stacking Mechanics for LTCG:
        // Taxable ordinary income ($30,000) occupies the bottom $30,000 of the capital gains brackets,
        // completely consuming CG Bracket 1 ($15k) and CG Bracket 2 ($15k).
        // Therefore, the $30,000 of LTCG (spanning from cumulative $30,000 to $60,000) falls entirely into CG Bracket 3:
        //   - $30,000 @ 25% = $7,500
        //   Cap Gains Tax = $7,500
        // Total Tax expected = $5,000 + $7,500 = $12,500
        const income: GrossIncome = {
            agi: 70000,
            ltcg: 30000,
        };

        const result = calculateTaxes(stackedRules, income);

        expect(result.taxableIncome).toBe(60000); // 70000 - 10000 SD
        expect(result.tax).toBe(12500);
    });

    it('effectively ignores ltcg if capitalGainsBrackets are missing from rules', () => {
        const rulesWithoutCapGains: TaxRules = {
            standardDeduction: 0,
            brackets: [
                {until: 20000, rate: 0.10},
                {until: Infinity, rate: 0.20},
            ],
        };

        // AGI = $20,000 with $10,000 ltcg. Without capitalGainsBrackets,
        // the entire $20,000 AGI is taxed as ordinary income:
        // - $20,000 @ 10% = $2,000
        const income: GrossIncome = {
            agi: 20000,
            ltcg: 10000,
        };

        const result = calculateTaxes(rulesWithoutCapGains, income);
        expect(result.tax).toBe(2000);
    });

    it('handles ordinary income less than standard deduction with remaining LTCG taxable', () => {
        // Standard Deduction = $10,000.
        // AGI = $22,000, where LTCG = $15,000.
        // Ordinary income before deduction = AGI - ltcg = $22,000 - $15,000 = $7,000.
        // Since ordinary income ($7,000) is less than the standard deduction ($10,000),
        // ordinary taxable income is $0.
        // Total taxable income = $22,000 AGI - $10,000 SD = $12,000.
        // Taxable ordinary income is $0, so LTCG starts at $0 in the cap gains brackets:
        // - $12,000 @ 5% = $600
        const income: GrossIncome = {
            agi: 22000,
            ltcg: 15000,
        };

        const result = calculateTaxes(stackedRules, income);
        expect(result.taxableIncome).toBe(12000);
        expect(result.tax).toBe(600);
    });

    it('stacks ordinary income above standard deduction alongside LTCG with correct bracket offset', () => {
        // Standard Deduction = $10,000.
        // AGI = $45,000, where LTCG = $15,000.
        // Ordinary income before deduction = AGI - LTCG = $45,000 - $15,000 = $30,000.
        // Taxable ordinary income = $30,000 - $10,000 (SD) = $20,000.
        // Total Taxable Income = $35,000.
        //
        // Stacking mechanics:
        // 1. Taxable ordinary income ($20,000) consumes ordinary brackets:
        //    - Full Bracket 1: $10,000 @ 10% = $1,000
        //    - Half of Bracket 2: $10,000 @ 20% = $2,000
        //    Ordinary Tax = $3,000
        // 2. Taxable ordinary income ($20,000) consumes the bottom $20,000 of capital gains brackets:
        //    - CG Bracket 1 ($15k width) is fully consumed.
        //    - CG Bracket 2 ($15k width) has $5,000 consumed ($20k - $15k), leaving $10,000 capacity.
        // 3. LTCG ($15,000) stacks on top starting at the $20,000 mark:
        //    - Remaining CG Bracket 2: $10,000 @ 15% = $1,500
        //    - Spillover into CG Bracket 3: $5,000 @ 25% = $1,250
        //    Cap Gains Tax = $1,500 + $1,250 = $2,750
        //
        // Total Tax expected = $3,000 + $2,750 = $5,750
        const income: GrossIncome = {
            agi: 45000,
            ltcg: 15000,
        };

        const result = calculateTaxes(stackedRules, income);
        expect(result.taxableIncome).toBe(35000);
        expect(result.tax).toBe(5750);
    });
});
