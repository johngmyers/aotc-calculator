export interface TaxBracket {
    rate: number
    until: number
}

export type TaxBrackets = TaxBracket[]

export interface TaxRules {
    brackets: TaxBrackets
    capitalGainsBrackets?: TaxBrackets
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
    ltcg?: number
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

    const ltcg = rules.capitalGainsBrackets ? Math.min(grossIncome.ltcg ?? 0, taxableIncome): 0;
    const ordinaryIncome = taxableIncome - ltcg

    for (const bracket of rules.brackets) {
        const incrementalIncome = Math.max(0, Math.min(ordinaryIncome, bracket.until) - previousBracket);
        tax += incrementalIncome * bracket.rate;
        previousBracket = Math.min(bracket.until, ordinaryIncome);
    }

    for (const bracket of rules.capitalGainsBrackets ?? []) {
        const incrementalIncome = Math.max(0, Math.min(taxableIncome, bracket.until) - previousBracket);
        tax += incrementalIncome * bracket.rate;
        previousBracket = Math.max(previousBracket, Math.min(bracket.until, taxableIncome));
    }

    tax = Math.round((tax + Number.EPSILON) * 100) / 100;
    return {
        taxableIncome: taxableIncome,
        tax: tax,
    };
}
