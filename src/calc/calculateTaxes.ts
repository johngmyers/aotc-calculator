import {round} from "./round.js";

export type TaxBracket = {
    rate: number
    until: number
}

export type TaxBrackets = TaxBracket[]

export interface TaxRules {
    brackets: TaxBrackets
}

export interface GrossIncome {
    agi: number
}

export type TaxCalculationResult = {
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

    tax = round(tax);
    return {
        taxableIncome: taxableIncome,
        tax: tax,
    };
}
