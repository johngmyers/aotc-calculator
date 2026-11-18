import {TaxRules} from "./calculateTaxes.js";
import {round} from "./round.js";

export interface AotcRules {
    firstTierCap: number             // 2000
    secondTierCap: number            // 4000
    secondTierRate: number           // 0.25
    phaseoutStart: number            // 80000 (Single/HOH) / 160000 (MFJ)
    phaseoutRange: number            // 10000 (Single/HOH) /  20000 (MFJ)
    refundableRate: number           // 0.4
}

export interface FederalTaxRules extends TaxRules {
    aotc?: AotcRules
}

export interface AotcStudentInput {
    qualifiedExpenses: number
}

export interface AotcInput {
    agi: number
    refundableIneligible?: boolean
    students: AotcStudentInput[]
}

export interface AotcResult {
    nonrefundableCredit: number
    refundableCredit: number
}

export function calculateAotc(rules: FederalTaxRules, input: AotcInput) : AotcResult {
    if (!rules.aotc) {
        return {
            nonrefundableCredit: 0,
            refundableCredit: 0,
        };
    }

    let adjustedExpenses = 0
    for (const student of input.students) {
        adjustedExpenses += Math.min(student.qualifiedExpenses, rules.aotc.firstTierCap);
        if (student.qualifiedExpenses > rules.aotc.firstTierCap) {
            const expensesInSecondTier = Math.min(student.qualifiedExpenses, rules.aotc.secondTierCap) - rules.aotc.firstTierCap;
            adjustedExpenses += round(expensesInSecondTier * rules.aotc.secondTierRate);
        }
    }

    const refundableCredit = (input.refundableIneligible ?? false) ? 0 : round(adjustedExpenses * rules.aotc.refundableRate);

    return {
        nonrefundableCredit: adjustedExpenses - refundableCredit,
        refundableCredit: refundableCredit,
    };
}