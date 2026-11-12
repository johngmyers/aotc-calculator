export interface TaxRules {
    brackets: Array<
        {
            rate: number
            until: number
        }
    >
}

export interface GrossIncome {
    agi: number
}

export interface TaxCalculationResult {
    taxableIncome: number
    tax: number
}

export function calculateTaxes(rules: TaxRules, grossIncome: GrossIncome) : TaxCalculationResult {
    const taxableIncome = Math.max(0, grossIncome.agi);

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
