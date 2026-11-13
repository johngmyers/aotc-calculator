export interface ExemptionPhaseoutRules {
    usesFederalAgi?: boolean
    threshold: number
    increment: number // per X amount of excess AGI.
    rate: number
}

export interface ExemptionRules {
    /** If true, the calculated total is treated as a non-refundable tax credit (CA style).
     *  If false, it is treated as a deduction from AGI to arrive at taxable income (Federal style). */
    exemptionIsCredit?: boolean
    taxpayerAmount: number
    dependentAmount: number
    seniorOrBlindAmount: number
    phaseout?: ExemptionPhaseoutRules
}

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
    exemption?: ExemptionRules
    kiddieTax?: {
        unearnedIncomeThreshold: number
        itemizedBase: number
    }
}

export interface ParentIncome {
    taxableIncome: number
    ltcg?: number
}

export interface GrossIncome {
    claimedAsDependent?: boolean
    agi: number
    ltcg?: number
    federalAgi?: number // For states that use federal AGI for phaseouts.

    // Exemptions
    dependentCount?: number
    seniorOrBlindCount?: number

    // Itemized deductions directly connected to unearned income for Form 8615 (Kiddie Tax).
    itemizedDeductions?: number
    mustItemize?: boolean

    // Below are only used if claimedAsDependent is true
    earnedIncome?: number
    taxableScholarships?: number
    directlyConnectedItemizedDeductions?: number

    // Parent return context for Form 8615 (Kiddie Tax). Omitted if not subject to such.
    parent?: {
        income: ParentIncome
        rules: TaxRules
    }
}

export interface TaxError {
    errorCode: string
    errorMessage: string
}

export interface TaxCalculationResult {
    taxableIncome: number
    tax: number
    outOfScopeForVITA: boolean
}

export type TaxCalculationOutcome = TaxError | TaxCalculationResult

export function calculateTaxes(rules: TaxRules, grossIncome: GrossIncome) : TaxCalculationOutcome {
    let outOfScopeForVITA = false
    let standardDeduction = rules.standardDeduction ?? 0;
    let itemizing = false
    if (grossIncome.mustItemize) {
        itemizing = true
        standardDeduction = 0;
    }
    const earnedIncome = grossIncome.earnedIncome ?? 0;
    const taxableScholarships = grossIncome.taxableScholarships ?? 0;
    if (grossIncome.claimedAsDependent && rules.dependentStandardDeduction) {
        const dependentStandardDeduction = Math.max(
            rules.dependentStandardDeduction.base,
            rules.dependentStandardDeduction.earnedAddOn + earnedIncome + taxableScholarships
        );

        standardDeduction = Math.min(standardDeduction, dependentStandardDeduction);
    }

    const deduction = Math.max(standardDeduction, grossIncome.itemizedDeductions ?? 0);
    if (deduction > standardDeduction) {
        itemizing = true
    }

    const exemptionIsCredit = rules.exemption?.exemptionIsCredit ?? false;
    const exemptionAmount = (() => {
        if (!rules.exemption || grossIncome.claimedAsDependent) return 0;

        const grossAmount = rules.exemption.taxpayerAmount +
            (grossIncome.dependentCount ?? 0) * rules.exemption.dependentAmount +
            (grossIncome.seniorOrBlindCount ?? 0) * rules.exemption.seniorOrBlindAmount;

        if (!rules.exemption.phaseout) return grossAmount;

        if (rules.exemption.phaseout.usesFederalAgi && grossIncome.federalAgi === undefined) {
            return {
                errorCode: 'MISSING_FEDERAL_AGI',
                errorMessage: 'Federal AGI needed for exemption phaseout'
            };
        }

        const relevantAgi = rules.exemption.phaseout.usesFederalAgi ? grossIncome.federalAgi! : grossIncome.agi
        const excessAgi = relevantAgi - rules.exemption.phaseout.threshold;
        if (excessAgi <= 0) return grossAmount;

        const increments = Math.ceil(excessAgi / rules.exemption.phaseout.increment);
        const reduction = increments * rules.exemption.phaseout.rate * grossAmount;

        return Math.max(0, grossAmount - Math.max(0, reduction));
    })();
    if (typeof(exemptionAmount) !== 'number') {
        return exemptionAmount
    }

    const taxableIncome = Math.max(0, grossIncome.agi - deduction - (exemptionIsCredit ? 0 : exemptionAmount));

    let tax = 0;
    let previousBracket = 0;

    const ltcg = rules.capitalGainsBrackets ? Math.min(grossIncome.ltcg ?? 0, taxableIncome) : 0;
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

    // Kiddie Tax
    const unearnedIncome = grossIncome.agi - earnedIncome;
    if (rules.kiddieTax && grossIncome.parent && unearnedIncome > rules.kiddieTax.unearnedIncomeThreshold) {
        outOfScopeForVITA = true;
        const unearnedIncomeThreshold = itemizing ?
            rules.kiddieTax.itemizedBase + (grossIncome.directlyConnectedItemizedDeductions ?? 0) :
            rules.kiddieTax.unearnedIncomeThreshold;
        if (unearnedIncome > unearnedIncomeThreshold && taxableIncome > 0) {
            const unearnedAboveThreshold = Math.min(unearnedIncome - unearnedIncomeThreshold, taxableIncome);
            const ltcgAboveThreshold = Math.min(unearnedAboveThreshold, ltcg);

            const tentativeParentGross = {
                agi: grossIncome.parent.income.taxableIncome + unearnedAboveThreshold,
                ltcg: (grossIncome.parent.income.ltcg ?? 0) + ltcgAboveThreshold,
                mustItemize: true,
            };
            const tentativeParentTax = calculateTaxes(grossIncome.parent.rules, tentativeParentGross);
            if ('errorCode' in tentativeParentTax) {
                return {
                    ...tentativeParentTax,
                    errorMessage: "calculating tentative parent kiddie tax: " + tentativeParentTax.errorMessage,
                }
            }

            const baseParentGross = {
                agi: grossIncome.parent.income.taxableIncome,
                ltcg: grossIncome.parent.income.ltcg,
                mustItemize: true,
            };
            const baseParentTax = calculateTaxes(grossIncome.parent.rules, baseParentGross);
            if ('errorCode' in baseParentTax) {
                return {
                    ...baseParentTax,
                    errorMessage: "calculating base parent kiddie tax: " + baseParentTax.errorMessage,
                }
            }

            // TODO: handle multiple children with unearnedAboveThreshold

            const childPortionGross = {
                agi: taxableIncome - unearnedAboveThreshold,
                ltcg: ltcg - ltcgAboveThreshold,
                mustItemize: true,
            };
            const childPortionTax = calculateTaxes(rules, childPortionGross);
            if ('errorCode' in childPortionTax) {
                return {
                    ...childPortionTax,
                    errorMessage: "calculating child portion of kiddie tax: " + childPortionTax.errorMessage,
                }
            }
            const tentativeKiddieTax = childPortionTax.tax + (tentativeParentTax.tax - baseParentTax.tax);
            if (tentativeKiddieTax > tax) {
                tax = tentativeKiddieTax;
            }
        }
    }

    tax = Math.round((tax + Number.EPSILON) * 100) / 100;

    if (exemptionIsCredit) {
        tax = Math.max(0, tax - exemptionAmount);
    }

    return {
        taxableIncome: taxableIncome,
        tax: tax,
        outOfScopeForVITA: outOfScopeForVITA,
    };
}
