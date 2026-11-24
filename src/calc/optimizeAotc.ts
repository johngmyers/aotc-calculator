import {TaxError} from "./calculateTaxes.js";
import {AotcInput, calculateAotc, FederalTaxRules} from "./calculateAotc.js";

export type StudentExpenseCost = { qualifiedExpenses: number } & (TaxError | {
    cost: number
    outOfScopeForVITA: boolean
});

function isTaxError(value: StudentExpenseCost): value is StudentExpenseCost & TaxError {
    return "errorCode" in value;
}

export function areStudentExpenseCostsEqual(
    a: readonly StudentExpenseCost[],
    b: readonly StudentExpenseCost[],
): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return a.every(
        (point, i) => {
            const other = b[i];
            if (point.qualifiedExpenses !== other.qualifiedExpenses) {
                return false;
            }

            if (isTaxError(point) && isTaxError(other)) {
                return (
                    point.errorCode === other.errorCode &&
                    point.errorMessage === other.errorMessage
                );
            }

            if (!isTaxError(point) && !isTaxError(other)) {
                return (
                    point.cost === other.cost &&
                    point.outOfScopeForVITA === other.outOfScopeForVITA
                );
            }

            return false;
        }
    )
}

export type OptimizeAotcParams = {
    rules: FederalTaxRules
    tiMinusNonrefundable: number
    stayWithinVitaScope: boolean
    input: AotcInput
    expenseCosts: StudentExpenseCost[][]
};

export function optimizeAotc({
                                 rules,
                                 tiMinusNonrefundable,
                                 stayWithinVitaScope,
                                 input,
                                 expenseCosts,
                             }: OptimizeAotcParams): AotcInput {
    // todo: Make this work for more than one student
    if (tiMinusNonrefundable < 0) {
        tiMinusNonrefundable = 0;
    }


    return {
        ...input,
        students: Array.from(
            {length: input.students.length},
            (_, i) => {
                let thisAotcInput = {
                    ...input,
                    students: [...input.students],
                };
                let bestQualifiedExpenses = expenseCosts[i][0].qualifiedExpenses;
                let bestBenefit = -1;
                for (const expenseCost of expenseCosts[i]) {
                    if ("errorCode" in expenseCost) {
                        continue;
                    }
                    if (stayWithinVitaScope && expenseCost.outOfScopeForVITA) {
                        continue;
                    }
                    thisAotcInput.students[i] = {
                        qualifiedExpenses: expenseCost.qualifiedExpenses,
                    };

                    const aotcResult = calculateAotc(rules, thisAotcInput);
                    const credit = aotcResult.refundableCredit + Math.min(tiMinusNonrefundable, aotcResult.nonrefundableCredit);
                    const benefit = credit - expenseCost.cost;
                    if (benefit > bestBenefit) {
                        bestQualifiedExpenses = expenseCost.qualifiedExpenses
                        bestBenefit = benefit;
                    }
                }

                return {
                    qualifiedExpenses: bestQualifiedExpenses,
                };
            }
        )
    }
}