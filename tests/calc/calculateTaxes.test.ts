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
        expect(calculateTaxes(cumulativeRules, {agi: 0})).toEqual({
            taxableIncome: 0,
            tax: 0,
            outOfScopeForVITA: false
        });
        expect(calculateTaxes(cumulativeRules, {agi: -1000})).toEqual({
            taxableIncome: 0,
            tax: 0,
            outOfScopeForVITA: false
        });
    });

    it('calculates tax within the first bracket', () => {
        // $6,000 * 10% = $600
        const result = calculateTaxes(cumulativeRules, {agi: 6000});
        expect(result.taxableIncome).toBe(6000);
        expect(result.tax).toBe(600);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('calculates tax exactly on a bracket boundary', () => {
        // $10,000 * 10% = $1,000
        const result = calculateTaxes(cumulativeRules, {agi: 10000});
        expect(result.tax).toBe(1000);
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('rounds fractional cents cleanly', () => {
        const fractionalRules: TaxRules = {
            brackets: [{until: Infinity, rate: 0.10555}]
        };
        // $100 * 0.10555 = 10.555 -> 10.56
        const result = calculateTaxes(fractionalRules, {agi: 100});
        expect(result.tax).toBe(10.56);
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('reduces taxableIncome to 0 and owes 0 tax when AGI equals standardDeduction', () => {
        const result = calculateTaxes(rulesWithDeduction, {agi: 16100});
        expect(result.taxableIncome).toBe(0);
        expect(result.tax).toBe(0);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('does not produce negative taxableIncome when AGI is 0 or negative', () => {
        expect(calculateTaxes(rulesWithDeduction, {agi: 0})).toEqual({
            taxableIncome: 0,
            tax: 0,
            outOfScopeForVITA: false,
        });
        expect(calculateTaxes(rulesWithDeduction, {agi: -2500})).toEqual({
            taxableIncome: 0,
            tax: 0,
            outOfScopeForVITA: false,
        });
    });

    it('applies brackets to post-deduction taxableIncome rather than gross AGI', () => {
        // AGI = $21,100 -> taxableIncome = $21,100 - $16,100 = $5,000
        // All $5,000 sits in the 10% bracket -> $500 tax
        const result = calculateTaxes(rulesWithDeduction, {agi: 21100});
        expect(result.taxableIncome).toBe(5000);
        expect(result.tax).toBe(500);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('aligns bracket boundaries with post-deduction taxableIncome', () => {
        // AGI = $26,100 -> taxableIncome = $10,000 (exact top of 10% bracket) -> $1,000 tax
        const atBoundary = calculateTaxes(rulesWithDeduction, {agi: 26100});
        expect(atBoundary.taxableIncome).toBe(10000);
        expect(atBoundary.tax).toBe(1000);
        expect(atBoundary.outOfScopeForVITA).toBe(false);

        // AGI = $26,101 -> taxableIncome = $10,001 ($1 spills into 12% bracket) -> $1,000.12 tax
        const overBoundary = calculateTaxes(rulesWithDeduction, {agi: 26101});
        expect(overBoundary.taxableIncome).toBe(10001);
        expect(overBoundary.tax).toBe(1000.12);
        expect(overBoundary.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('behaves identically to prior behavior when standardDeduction is explicitly 0', () => {
        const zeroDeductionRules: TaxRules = {
            ...rulesWithDeduction,
            standardDeduction: 0,
        };
        const result = calculateTaxes(zeroDeductionRules, {agi: 45000});
        expect(result.taxableIncome).toBe(45000);
        expect(result.tax).toBe(5700);
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(mustItemizeResult.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
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
        expect(result.outOfScopeForVITA).toBe(false);
    });
});

describe('calculateTaxes - itemizedDeductions in GrossIncome', () => {
    const baseRules: TaxRules = {
        standardDeduction: 10000,
        brackets: [
            {until: 10000, rate: 0.10},
            {until: 30000, rate: 0.20},
            {until: Infinity, rate: 0.30},
        ],
    };

    it('applies standard deduction when itemized deductions are lower', () => {
        // AGI = $25,000, itemizedDeductions = $7,000 (lower than standardDeduction of $10,000).
        // Effective deduction = max($10,000 standard, $7,000 itemized) = $10,000.
        // Taxable income = $25,000 - $10,000 = $15,000.
        // - First $10,000 @ 10% = $1,000
        // - Remaining $5,000 @ 20% = $1,000
        // Total Tax = $2,000
        const income: GrossIncome = {
            agi: 25000,
            itemizedDeductions: 7000,
        };

        const result = calculateTaxes(baseRules, income);
        expect(result.taxableIncome).toBe(15000);
        expect(result.tax).toBe(2000);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('applies itemized deductions when they exceed the standard deduction', () => {
        // AGI = $30,000, itemizedDeductions = $14,000 (higher than standardDeduction of $10,000).
        // Effective deduction = max($10,000 standard, $14,000 itemized) = $14,000.
        // Taxable income = $30,000 - $14,000 = $16,000.
        // - First $10,000 @ 10% = $1,000
        // - Remaining $6,000 @ 20% = $1,200
        // Total Tax = $2,200
        const income: GrossIncome = {
            agi: 30000,
            itemizedDeductions: 14000,
        };

        const result = calculateTaxes(baseRules, income);
        expect(result.taxableIncome).toBe(16000);
        expect(result.tax).toBe(2200);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('compares itemized deductions against the calculated dependent standard deduction when claimed as a dependent', () => {
        // Dependent rules: basic cap = $10,000, base = $1,350, earnedAddOn = $450.
        // Earned income = $5,000 -> calculated dependent SD = max(1350, 5000 + 450) = $5,450.
        // Itemized deductions = $7,000.
        // Since itemized ($7,000) > calculated dependent SD ($5,450), itemized deductions should win.
        // AGI = $20,000 - $7,000 = $13,000 taxable income.
        const dependentRules: TaxRules = {
            standardDeduction: 10000,
            dependentStandardDeduction: {
                base: 1350,
                earnedAddOn: 450,
            },
            brackets: [
                {until: 10000, rate: 0.10},
                {until: Infinity, rate: 0.20},
            ],
        };

        const income: GrossIncome = {
            agi: 20000,
            claimedAsDependent: true,
            earnedIncome: 5000,
            itemizedDeductions: 7000,
        };

        const result = calculateTaxes(dependentRules, income);
        expect(result.taxableIncome).toBe(13000); // $20,000 - $7,000 itemized
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('applies itemized deductions when they exceed the dependent standard deduction even if below non-dependent standard deduction', () => {
        // Dependent rules: basic cap = $10,000, base = $1,350, earnedAddOn = $450.
        // Earned income = $2,000 -> calculated dependent SD = max(1350, 2000 + 450) = $2,450.
        // Itemized deductions = $5,000 (below non-dependent SD of $10,000, but higher than dependent SD of $2,450).
        // Effective deduction = max($2,450 dependent SD, $5,000 itemized) = $5,000 itemized.
        // AGI = $15,000 - $5,000 = $10,000 taxable income.
        const dependentRules: TaxRules = {
            standardDeduction: 10000,
            dependentStandardDeduction: {
                base: 1350,
                earnedAddOn: 450,
            },
            brackets: [
                {until: 10000, rate: 0.10},
                {until: Infinity, rate: 0.20},
            ],
        };

        const income: GrossIncome = {
            agi: 15000,
            claimedAsDependent: true,
            earnedIncome: 2000,
            itemizedDeductions: 5000,
        };

        const result = calculateTaxes(dependentRules, income);
        expect(result.taxableIncome).toBe(10000);
        expect(result.tax).toBe(1000);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('applies dependent standard deduction when itemized deductions are lower than dependent standard deduction', () => {
        // Earned income = $6,000 -> calculated dependent SD = max(1350, 6000 + 450) = $6,450.
        // Itemized deductions = $4,000 (lower than dependent SD of $6,450).
        // Effective deduction = max($6,450 dependent SD, $4,000 itemized) = $6,450 dependent SD.
        // AGI = $15,000 - $6,450 = $8,550 taxable income.
        const dependentRules: TaxRules = {
            standardDeduction: 10000,
            dependentStandardDeduction: {
                base: 1350,
                earnedAddOn: 450,
            },
            brackets: [
                {until: 10000, rate: 0.10},
                {until: Infinity, rate: 0.20},
            ],
        };

        const income: GrossIncome = {
            agi: 15000,
            claimedAsDependent: true,
            earnedIncome: 6000,
            itemizedDeductions: 4000,
        };

        const result = calculateTaxes(dependentRules, income);
        expect(result.taxableIncome).toBe(8550);
        expect(result.tax).toBe(855);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('correctly integrates itemized deductions with capital gains bracket stacking', () => {
        // Standard Deduction = $10,000, Itemized Deductions = $15,000 in GrossIncome (Wins).
        // AGI = $50,000, where LTCG = $20,000.
        // Ordinary income before deduction = AGI - LTCG = $50,000 - $20,000 = $30,000.
        // Taxable ordinary income = $30,000 - $15,000 (Itemized) = $15,000.
        // Total taxable income = $50,000 - $15,000 = $35,000.
        //
        // Stacking mechanics:
        // 1. Taxable ordinary income ($15,000) consumes ordinary brackets:
        //    - Full Bracket 1 ($10k width) @ 10% = $1,000
        //    - Remaining Bracket 2 ($5k) @ 20% = $1,000
        //    Ordinary Tax = $2,000
        // 2. Taxable ordinary income ($15,000) consumes the bottom $15,000 of capital gains brackets:
        //    - CG Bracket 1 ($15k width) is fully consumed.
        // 3. LTCG ($20,000) stacks on top starting at the $15,000 mark:
        //    - Fills CG Bracket 2 ($15k width) @ 15% = $2,250
        //    - Spillover into CG Bracket 3 ($5k) @ 25% = $1,250
        //    Cap Gains Tax = $2,250 + $1,250 = $3,500
        //
        // Total Tax = $2,000 + $3,500 = $5,500
        const stackingRulesWithCapGains: TaxRules = {
            standardDeduction: 10000,
            brackets: [
                {until: 10000, rate: 0.10},
                {until: 30000, rate: 0.20},
                {until: Infinity, rate: 0.30},
            ],
            capitalGainsBrackets: [
                {until: 15000, rate: 0.05},
                {until: 30000, rate: 0.15},
                {until: Infinity, rate: 0.25},
            ],
        };

        const income: GrossIncome = {
            agi: 50000,
            ltcg: 20000,
            itemizedDeductions: 15000,
        };

        const result = calculateTaxes(stackingRulesWithCapGains, income);

        expect(result.taxableIncome).toBe(35000);
        expect(result.tax).toBe(5500);
        expect(result.outOfScopeForVITA).toBe(false);
    });
});

describe('calculateTaxes - Form 8615 (Kiddie Tax)', () => {
    const parentRules: TaxRules = {
        standardDeduction: 32000,
        brackets: [
            {until: 24000, rate: 0.10},
            {until: 96000, rate: 0.12},
            {until: Infinity, rate: 0.22},
        ],
        capitalGainsBrackets: [
            {until: 94000, rate: 0.05},
            {until: 584000, rate: 0.15},
            {until: Infinity, rate: 0.20},
        ],
    };

    const childRules: TaxRules = {
        standardDeduction: 16000,
        dependentStandardDeduction: {
            base: 1400,
            earnedAddOn: 600,
        },
        brackets: [
            {until: 12000, rate: 0.10},
            {until: 48000, rate: 0.12},
            {until: Infinity, rate: 0.22},
        ],
        capitalGainsBrackets: [
            {until: 47000, rate: 0.05},
            {until: 519000, rate: 0.15},
            {until: Infinity, rate: 0.20},
        ],
        kiddieTax: {
            unearnedIncomeThreshold: 2600,
            itemizedBase: 1350,
        },
    };

    it('does not engage Kiddie Tax when child unearned income is below the threshold even though taxable income exceeds it', () => {
        // Bracket breakdown for child return:
        // - Child AGI = $22,000, earnedIncome = $20,000 -> Unearned income = $2,000 (<= $2,600 threshold).
        // - Dependent SD hits the basic cap ($16,000).
        // - Child Taxable Income = $22,000 - $16,000 = $6,000.
        // - Bracket breakdown for $6,000 taxable income:
        //   * $6,000 falls entirely within Child Bracket 1 ($0 to $12,000) @ 10% = $600.00.
        // - Unearned income ($2,000) is below threshold, so Kiddie Tax does not engage.
        const income: GrossIncome = {
            agi: 22000,
            claimedAsDependent: true,
            earnedIncome: 20000,
            parent: {
                income: {
                    taxableIncome: 100000,
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(6000);
        expect(result.tax).toBe(600);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('handles a return that remains in scope for VITA despite itemizing and unearned income of $2,000', () => {
        // Test Setup & Scope Strategy:
        // 1. VITA Scope Check for Form 8615:
        //    - Form 8615 is required when a dependent child has unearned income exceeding the statutory threshold ($2,700).
        //    - In this case, the child's unearned income is $2,000, which sits below the $2,700 threshold,
        //      even though itemizing deductions can effectively compress the unearned income floor under certain rules.
        //    - Because unearned income does not cross $2,700, Form 8615 is NOT triggered,
        //      keeping the return within the standard scope for VITA despite the child itemizing.
        //
        // 2. Child Return & Deduction Logic:
        //    - Total AGI = $5,000 ($2,000 unearned + $3,000 earned).
        //    - Itemized deductions = $5,000 (exceeding dependent standard deduction of $3,450).
        //    - Taxable Income = $5,000 AGI - $5,000 itemized deductions = $0.
        //    - Total Tax = $0.00.
        //    - outOfScopeForVITA = false (Form 8615 not required).
        const income: GrossIncome = {
            agi: 5000,
            claimedAsDependent: true,
            earnedIncome: 3000,
            itemizedDeductions: 5000,
            directlyConnectedItemizedDeductions: 0,
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(0);
        expect(result.tax).toBe(0);
        expect(result.outOfScopeForVITA).toBe(false);
    });

    it('engages Kiddie Tax with zero earned income when unearned income exceeds the threshold', () => {
        // Bracket breakdown:
        // 1. Parent Baseline Tax (AGI $72,000 - SD $32,000 = $40,000 Taxable Income):
        //    - Bracket 1 ($0 to $24,000) @ 10% = $2,400.00
        //    - Bracket 2 ($24,000 to $40,000 -> $16,000 width) @ 12% = $1,920.00
        //    Total Baseline Parent Tax = $4,320.00.
        //
        // 2. Child Return (AGI $10,000 unearned, earnedIncome = $0):
        //    - Dependent SD = $1,400 -> Child Taxable Income = $8,600.
        //    - Net Unearned Income subject to parent rate = $10,000 - $2,600 threshold = $7,400.
        //    - Child-rate portion = $8,600 - $7,400 = $1,200 taxed at child Bracket 1 (10%) = $120.00.
        //
        // 3. Parent + Net Unearned Income Stack ($40,000 + $7,400 = $47,400 Taxable Income):
        //    - Bracket 1 ($0 to $24,000) @ 10% = $2,400.00
        //    - Bracket 2 ($24,000 to $47,400 -> $23,400 width) @ 12% = $2,808.00
        //    Total Stack Tax = $5,208.00.
        //    Incremental Parent Tax = $5,208.00 - $4,320.00 = $888.00 (all falling into parent 12% bracket).
        //    Total Child Tax = $120.00 (child bracket) + $888.00 (parent bracket) = $1,008.00.
        const income: GrossIncome = {
            agi: 10000,
            claimedAsDependent: true,
            earnedIncome: 0,
            parent: {
                income: {
                    taxableIncome: 72000,
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(8600);
        expect(result.tax).toBe(1008);
        expect(result.outOfScopeForVITA).toBe(true);
    });

    it('engages Kiddie Tax with substantial earned and unearned income, pushing the parent stack across distinct 12% and 22% brackets', () => {
        // Bracket breakdown:
        // 1. Standard Parent Rules & Baseline Tax: $90,000 Taxable Income):
        //    - Bracket 1 ($0 to $24,000) @ 10% = $2,400.00
        //    - Bracket 2 ($24,000 to $90,000 -> $66,000 width) @ 12% = $7,920.00
        //    Total Baseline Parent Tax = $10,320.00. (Remaining capacity in 12% bracket is $6,000, up to the $96,000 threshold).
        //
        // 2. Child Return (AGI $20,000 total, with earnedIncome = $8,000 and unearned income = $12,000):
        //    - Dependent SD = max(1400, 8000 + 600) = $8,600 -> Child Taxable Income = $11,400.
        //    - Net Unearned Income subject to parent rate = $12,000 unearned - $2,600 threshold = $9,400.
        //    - Child-rate portion = $11,400 TI - $9,400 net unearned = $2,000 taxed at child Bracket 1 (10%) = $200.00.
        //
        // 3. Parent + Net Unearned Income Stack ($90,000 + $9,400 = $99,400 Taxable Income):
        //    Spans across two distinct parental rates:
        //    - First $6,000 fills the remaining 12% bracket capacity ($90k to $96k) @ 12% = $720.00.
        //    - Remaining $3,400 spills into Parent Bracket 3 ($96k to $99,400) @ 22% = $748.00.
        //    Total Stack Tax = $10,320 (baseline) + $720 + $748 = $11,788.00.
        //    Incremental Parent Tax = $1,468.00.
        //    Total Child Tax = $200.00 (child bracket @ 10%) + $1,468.00 (parent brackets @ 12%/22%) = $1,668.00.
        const income: GrossIncome = {
            agi: 20000,
            claimedAsDependent: true,
            earnedIncome: 8000, // Unearned = $12,000 (> $2,600 threshold)
            parent: {
                income: {
                    taxableIncome: 90000, // Yields $90,000 taxable ordinary income
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(11400);
        expect(result.tax).toBe(1668);
        expect(result.outOfScopeForVITA).toBe(true);
    });

    it('handles child ltcg spanning the border between child and parental capital gains brackets', () => {
        // Bracket breakdown:
        // 1. Child Capital Gains & Ordinary Income Stack:
        //    - Child AGI = $11,000 total unearned ($10,000 LTCG + $1,000 ordinary unearned), earnedIncome = $0.
        //    - Dependent SD = $1,400 -> Absorbs the $1,000 ordinary unearned and $400 of the LTCG,
        //      leaving Child Taxable Income = $9,600 (all $9,600 is taxable LTCG, $0 ordinary taxable income).
        //    - Net Unearned Income subject to parent rate = ($11,000 total unearned) - $2,600 threshold = $8,400.
        //      * The $2,600 threshold first absorbs the $1,000 ordinary unearned income.
        //      * The remaining $1,600 of the threshold is subtracted from the LTCG ($10,000 - $1,600 = $8,400 net LTCG).
        //    - Child-rate portion = $9,600 TI - $8,400 net unearned = $1,200 taxed at the child's capital gains rate (5%) = $60.00.
        //
        // 2. Parent Baseline Tax ($90,000 Taxable Ordinary Income) + $4,000 Baseline LTCG:
        //    - Ordinary Tax: ($24,000 @ 10%) + ($66,000 @ 12%) = $2,400.00 + $7,920.00 = $10,320.00.
        //    - Capital Gains Tax: Parent's $90,000 ordinary income occupies the bottom $90,000 of CG brackets.
        //      Baseline LTCG ($4,000) brings the cumulative stack to $94,000, exactly reaching the CG Bracket 1 threshold ($94,000 @ 5%) = $4,700.00.
        //    Total Baseline Parent Tax = $10,320.00 (ordinary) + $4,700.00 (CG) = $15,020.00.
        //
        // 3. Parent + Child Net Unearned Stack:
        //    - Ordinary Stack ($90,000 ordinary + $0 net ordinary unearned = $90,000 taxable ordinary income):
        //      Incremental ordinary parent tax = $0.00.
        //    - Capital Gains Stack ($90,000 ordinary + $4,000 baseline LTCG + $8,400 net unearned LTCG = $102,400 cumulative CG stack):
        //      * The first $4,000 of LTCG sits at the 5% bracket limit ($90,000 to $94,000) = $200.00 (already accounted for in baseline).
        //      * The remaining $8,400 of net unearned LTCG spills entirely into parent CG Bracket 2 ($94,000 to $102,400) @ 15% = $1,260.00.
        //      Incremental CG parent tax = $1,260.00.
        //
        // 4. Total Child Tax Summary:
        //    - Child-rate portion: $60.00 (taxed at the child's 5% capital gains rate on the $1,200 child-rate taxable income component)
        //    - Incremental parent ordinary portion: $0.00 (ordinary unearned gross income was fully absorbed below the threshold)
        //    - Incremental parent capital gains portion: $1,260.00 (taxed at parent's 15% marginal capital gains rate on the $8,400 net unearned LTCG)
        //    Total Child Tax = $60.00 (child CG bracket) + $0.00 (parent ordinary TI) + $1,260.00 (parent CG) = $1,320.00.
        const income: GrossIncome = {
            agi: 11000, // $10,000 LTCG + $1,000 ordinary unearned
            ltcg: 10000,
            claimedAsDependent: true,
            parent: {
                income: {
                    taxableIncome: 94000, // Yields $90,000 taxable ordinary income
                    ltcg: 4000,
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(9600);
        expect(result.tax).toBe(1320);
        expect(result.outOfScopeForVITA).toBe(true);
    });

    it('engages Kiddie Tax where parental ltcg stack starts inside the parent 15% capital gains bracket and spans across into the 20% bracket using standard rules', () => {
        // Parent Baseline Position:
        // - Parent Taxable Ordinary Income = $400,000, Long-Term Capital Gains = $180,000
        //   (Cumulative baseline stack = $580,000, leaving exactly $4,000 capacity in the 15% CG bracket
        //   up to the $584,000 20% threshold).
        // - Parent Ordinary Income Brackets Breakdown (`parentRules.brackets`):
        //   * Bracket 1 ($0 to $24,000) @ 10% = $2,400.00
        //   * Bracket 2 ($24,000 to $96,000, width $72,000) @ 12% = $8,640.00
        //   * Bracket 3 ($96,000 to $400,000, width $304,000) @ 22% = $66,880.00
        //   * Total Baseline Parent Ordinary Tax = $77,920.00.
        // - Parent Capital Gains Stacking Breakdown (`parentRules.capitalGainsBrackets`):
        //   * Ordinary taxable income ($400,000) occupies the bottom $400,000 of the income spectrum.
        //   * Baseline LTCG ($180,000) spans from $400,000 to $580,000:
        //     - Sits entirely within CG Bracket 2 ($94,000 to $584,000) @ 15% = $27,000.00.
        //   * Total Baseline Parent Tax = $77,920 (ordinary) + $27,000 (CG) = $104,920.00.
        //
        // Child Tax Components & Breakdown:
        // - Gross Unearned Income (AGI) = $15,000 total unearned ($10,000 LTCG + $5,000 ordinary unearned), earnedIncome = $0.
        // - Dependent Standard Deduction = $1,400 (absorbs the first $1,400 of ordinary unearned income).
        // - Child Taxable Income = $13,600 total taxable income (composed of $3,600 taxable ordinary income + $10,000 LTCG).
        // - Net Unearned Income (Kiddie Tax Scope) = $15,000 total unearned - $2,600 statutory threshold = $12,400 total
        //   (composed of $2,400 net ordinary unearned + $10,000 net LTCG).
        // - Child-Rate Taxable Income Portion = $1,200 ($13,600 total taxable income minus $12,400 net unearned income), taxed at child's own 10% bracket = $120.00.
        //
        // Parent + Net Unearned Income Stack Breakdown:
        // 1. Parent Ordinary Income Stack ($400,000 + $2,400 net ordinary unearned = $402,400):
        //    - The $2,400 ordinary unearned falls entirely into Parent Bracket 3 ($400,000 to $402,400) @ 22% = $528.00.
        // 2. Parent Capital Gains Stack ($580,000 cumulative baseline + $10,000 net unearned LTCG = $590,000 cumulative stack):
        //    - Baseline leaves $4,000 of 15% bracket headroom. The child's $2,400 ordinary unearned income
        //      pushes the starting point up by $2,400, reducing remaining 15% headroom to $1,600 ($4,000 - $2,400).
        //    - First $1,600 (from $582,400 to $584,000 threshold) in CG Bracket 2 @ 15% = $240.00.
        //    - Remaining $8,400 (spilling over $584,000 into CG Bracket 3) @ 20% = $1,680.00.
        //    - Total Incremental Parent CG Tax = $240.00 + $1,680.00 = $1,920.00.
        //
        // Total Combined Kiddie Tax and Parent-Rate Tax Summary:
        // - Child-Rate Portion: $120.00
        // - Parent Ordinary Portion: $528.00
        // - Parent Capital Gains Portion: $1,920.00
        // - Total Tax = $120.00 + $528.00 + $1,920.00 = $2,568.00.
        const income: GrossIncome = {
            agi: 15000,
            ltcg: 10000,
            claimedAsDependent: true,
            parent: {
                income: {
                    taxableIncome: 580000,
                    ltcg: 180000, // Ordinary income portion $400,000
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(13600);
        expect(result.tax).toBe(2568);
        expect(result.outOfScopeForVITA).toBe(true);
    });

    it('handles itemized deductions for Form 8615 Line 2 calculations', () => {
        // Bracket breakdown:
        // 1. Parent Baseline Tax ($91,500 Taxable Income):
        //    - Bracket 1 ($0 to $24,000) @ 10% = $2,400.00
        //    - Bracket 2 ($24,000 to $91,500 -> $67,500 width) @ 12% = $8,100.00
        //    Total Baseline Parent Tax = $10,500.00. (Remaining capacity in 12% bracket is $4,500, up to the $96,000 threshold).
        //
        // 2. Child Return & Line 2 Threshold (AGI $15,000 total: $3,000 earned + $12,000 unearned; itemizedDeductions = $5,000):
        //    - Itemized deductions ($5,000) exceed dependent SD ($3,600) -> Child Taxable Income = $15,000 - $5,000 = $10,000.
        //    - Line 2 Threshold = max(itemizedBase $1,350 + directlyConnected $2,000, unearnedIncomeThreshold $2,600) = $3,350.
        //    - Net Unearned Income subject to parent rate = $12,000 unearned - $3,350 threshold = $8,650.
        //    - Child-rate portion = $10,000 TI - $8,650 net unearned = $1,350 taxed at child Bracket 1 (10%) = $135.00.
        //
        // 3. Parent + Net Unearned Income Stack ($91,500 + $8,650 = $100,150 Taxable Income):
        //    - First $4,500 fills remaining Parent Bracket 2 capacity ($91,500 to $96,000) @ 12% = $540.00.
        //    - Remaining $4,150 spills into Parent Bracket 3 ($96,000 to $100,150) @ 22% = $913.00.
        //    Incremental Parent Tax = $540.00 + $913.00 = $1,453.00.
        //
        // 4. Total Child Tax = $135.00 (child bracket @ 10%) + $1,453.00 (parent brackets @ 12%/22%) = $1,588.00.
        const income: GrossIncome = {
            agi: 15000,
            claimedAsDependent: true,
            earnedIncome: 3000,
            itemizedDeductions: 5000,
            directlyConnectedItemizedDeductions: 2000,
            parent: {
                income: {
                    taxableIncome: 91500,
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(10000);
        expect(result.tax).toBe(1588);
        expect(result.outOfScopeForVITA).toBe(true);
    });

    it('generates zero Kiddie Tax when taxable income is 0 despite unearned income exceeding the threshold (Line 5 bail)', () => {
        // - Child AGI = $10,000 unearned, earnedIncome = $0.
        // - Itemized deductions = $10,000 (exceeding dependent standard deduction of $1,400).
        // - Taxable Income = $10,000 AGI - $10,000 itemized deductions = $0.
        // - Unearned income ($10,000) exceeds the $2,600 threshold, but because taxable income is 0,
        //   Form 8615 yields $0 tax and the return is out of scope.
        const income: GrossIncome = {
            agi: 10000,
            claimedAsDependent: true,
            earnedIncome: 0,
            itemizedDeductions: 10000,
            parent: {
                income: {
                    taxableIncome: 100000,
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(0);
        expect(result.tax).toBe(0);
        expect(result.outOfScopeForVITA).toBe(true);
    });

    it('generates zero Kiddie Tax when net unearned income drops to zero (Line 3 bail)', () => {
        // - Child AGI = $8,000 ($5,000 unearned + $3,000 earned).
        // - Dependent Standard Deduction = max($1,350, $3,000 earned + $600 add-on) = $3,600.
        // - Itemized Deductions = $3,650 (all $3,650 directly connected to production of unearned income).
        // - Because itemized deductions ($3,650) exceed the dependent standard deduction ($3,600), the child itemizes:
        //   * Child Taxable Income = $8,000 AGI - $3,650 itemized deductions = $4,350 (nonzero).
        // - Form 8615 Line 3 Net Unearned Income Calculation:
        //   * Line 1 (Unearned income) = $5,000.
        //   * Line 2 (Itemized deduction threshold) = max($1,350 + $3,650 directly connected, $2,700) = $5,000.
        //   * Line 3 (Net unearned income) = max(0, $5,000 - $5,000) = $0 -> Form 8615 bails with $0 Kiddie Tax.
        // - Tax Breakdown:
        //   * Full $4,350 taxable income is taxed at the child's own 10% bracket = $435.00.
        //   * Because gross unearned income ($5,000) exceeds the statutory threshold ($2,700), Form 8615 is still
        //     required (`outOfScopeForVITA: true`).
        const income: GrossIncome = {
            agi: 8000,
            claimedAsDependent: true,
            earnedIncome: 3000,
            itemizedDeductions: 3650,
            directlyConnectedItemizedDeductions: 3650,
            parent: {
                income: {
                    taxableIncome: 100000,
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(4350);
        expect(result.tax).toBe(435);
        expect(result.outOfScopeForVITA).toBe(true);
    });

    it('generates zero Kiddie Tax when tentative tax under parent rates is lower than child standalone tax (Line 18 floor)', () => {
        // - Child AGI = $60,000 unearned, earnedIncome = $0 -> Dependent Standard Deduction = $1,400 -> Taxable Income = $58,600.
        // - Parent Taxable Income = $20,000 (MFJ brackets: 10% up to $24k, 12% up to $96k).
        //
        // 1. Standalone Child Tax (Form 8615 Line 17):
        //    - First $12,000 @ 10% = $1,200.00
        //    - Next $36,000 ($12,000 to $48,000) @ 12% = $4,320.00
        //    - Remaining $10,600 ($48,000 to $58,600) @ 22% = $2,332.00
        //    - Total Standalone Child Tax = $7,852.00.
        //
        // 2. Tentative Tax Under Kiddie Tax Rules (Form 8615 Line 15):
        //    - Net Unearned Income = $60,000 - $2,600 threshold = $57,400.
        //    - Child-rate slice = $58,600 - $57,400 = $1,200 @ 10% = $120.00.
        //    - Parent stack = $20,000 baseline + $57,400 net unearned = $77,400:
        //      * First $4,000 ($20,000 to $24,000) in Parent Bracket 1 @ 10% = $400.00.
        //      * Remaining $53,400 ($24,000 to $77,400) in Parent Bracket 2 @ 12% = $6,408.00.
        //      * Incremental Parent Tax = $6,808.00.
        //    - Total Tentative Tax = $120.00 + $6,808.00 = $6,928.00.
        //
        // 3. Form 8615 Line 18 Comparison:
        //    - Tentative tax ($6,928) is lower than the child's standalone tax ($7,852) because the parent's wider
        //      brackets absorb the income at 10%/12% before hitting 22%.
        //    - Line 18 floors the tax at the child's standalone tax of $7,852 ($0 incremental Kiddie Tax),
        //      while Form 8615 remains required (`outOfScopeForVITA: true`).
        const income: GrossIncome = {
            agi: 60000,
            claimedAsDependent: true,
            earnedIncome: 0,
            parent: {
                income: {
                    taxableIncome: 20000,
                },
                rules: parentRules,
            },
        };

        const result = calculateTaxes(childRules, income);
        expect(result.taxableIncome).toBe(58600);
        expect(result.tax).toBe(7852);
        expect(result.outOfScopeForVITA).toBe(true);
    });
});
