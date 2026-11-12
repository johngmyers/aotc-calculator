export interface TaxRules {
    brackets: Array<
        {
            rate: number
            until: number
        }
    >
    standardDeduction?: number
    dependentStandardDeduction?: {
        base: number
        earnedAddOn: number
    }
}

export interface GrossIncome {
    claimedAsDependent?: boolean
    earnedIncome?: number // Only used if claimedAsDependent is true
    taxableScholarships?: number // Only used if claimedAsDependent is true
    agi: number
    mustItemize?: boolean
}

export interface TaxCalculationResult {
    taxableIncome: number
    tax: number
}

export function calculateTaxes(rules: TaxRules, grossIncome: GrossIncome) : TaxCalculationResult {
    let standardDeduction = rules.standardDeduction ?? 0;
    if (grossIncome.mustItemize) {
        standardDeduction = 0;
    }
    if (grossIncome.claimedAsDependent && rules.dependentStandardDeduction) {
        const dependentStandardDeduction = Math.max(
            rules.dependentStandardDeduction.base,
            rules.dependentStandardDeduction.earnedAddOn + (grossIncome.earnedIncome ?? 0) + (grossIncome.taxableScholarships ?? 0)
        );

        standardDeduction = Math.min(standardDeduction, dependentStandardDeduction);
    }

    const taxableIncome = Math.max(0, grossIncome.agi - standardDeduction);

    let tax = 0;
    let previousBracket = 0;
    for (const bracket of rules.brackets) {
        const incrementalIncome = Math.max(0, Math.min(taxableIncome, bracket.until) - previousBracket);
        tax += incrementalIncome * bracket.rate;
        previousBracket = bracket.until;
    }

    tax = Math.round((tax + Number.EPSILON) * 100) / 100;
    return {
        taxableIncome: taxableIncome,
        tax: tax,
    };
}
