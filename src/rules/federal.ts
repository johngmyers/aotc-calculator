import type {AotcRules, FederalTaxRules} from "../calc/calculateAotc.js";
import type {TaxBrackets, TaxRules} from "../calc/calculateTaxes.js";

export type FilingStatus = "single" | "mfj" | "qss" | "mfs" | "hoh";
export type FederalTaxYear = 2026 | 2027;

/**
 * AOTC statutory parameters keyed by the year the thresholds came into effect.
 * Base AOTC parameters ($2,000 / $4,000 tiers, 25% second tier, 40% refundable)
 * remain unchanged in IRC § 25A.
 */
const AOTC_RULES_2009_SINGLE: AotcRules = {
    firstTierCap: 2000,
    secondTierCap: 4000,
    secondTierRate: 0.25,
    phaseoutStart: 80000,
    phaseoutRange: 10000,
    refundableRate: 0.4,
};

const AOTC_RULES_2009_JOINT: AotcRules = {
    firstTierCap: 2000,
    secondTierCap: 4000,
    secondTierRate: 0.25,
    phaseoutStart: 160000,
    phaseoutRange: 20000,
    refundableRate: 0.4,
};

/**
 * Data lookup for AOTC rules by filing status.
 * `mfs` is intentionally omitted because married filing separately is statutorily
 * ineligible for AOTC under IRC § 25A(g)(6).
 */
const AOTC_RULES_BY_STATUS_2009: Partial<Record<FilingStatus, AotcRules>> = {
    single: AOTC_RULES_2009_SINGLE,
    hoh: AOTC_RULES_2009_SINGLE,
    mfj: AOTC_RULES_2009_JOINT,
    qss: AOTC_RULES_2009_JOINT,
};

// 2026 Ordinary Brackets & Standard Deductions (Rev. Proc. 2025-32)
const BRACKETS_2026_SINGLE: TaxBrackets = [
    { rate: 0.10, until: 12400 },
    { rate: 0.12, until: 50400 },
    { rate: 0.22, until: 105700 },
    { rate: 0.24, until: 201775 },
    { rate: 0.32, until: 256225 },
    { rate: 0.35, until: 640600 },
    { rate: 0.37, until: Infinity },
];

const BRACKETS_2026_JOINT: TaxBrackets = [
    { rate: 0.10, until: 24800 },
    { rate: 0.12, until: 100800 },
    { rate: 0.22, until: 211400 },
    { rate: 0.24, until: 403550 },
    { rate: 0.32, until: 512450 },
    { rate: 0.35, until: 768700 },
    { rate: 0.37, until: Infinity },
];

// MFS matches Single through 32% ($256,225), then splits at 35% ($384,350 = half of MFJ $768,700).
const BRACKETS_2026_MFS: TaxBrackets = [
    { rate: 0.10, until: 12400 },
    { rate: 0.12, until: 50400 },
    { rate: 0.22, until: 105700 },
    { rate: 0.24, until: 201775 },
    { rate: 0.32, until: 256225 },
    { rate: 0.35, until: 384350 },
    { rate: 0.37, until: Infinity },
];

const BRACKETS_2026_HOH: TaxBrackets = [
    { rate: 0.10, until: 17700 },
    { rate: 0.12, until: 67450 },
    { rate: 0.22, until: 105700 },
    { rate: 0.24, until: 201750 },
    { rate: 0.32, until: 256200 },
    { rate: 0.35, until: 640600 },
    { rate: 0.37, until: Infinity },
];

const BRACKETS_2026: Record<FilingStatus, TaxBrackets> = {
    single: BRACKETS_2026_SINGLE,
    mfj: BRACKETS_2026_JOINT,
    qss: BRACKETS_2026_JOINT,
    mfs: BRACKETS_2026_MFS,
    hoh: BRACKETS_2026_HOH,
};

const STANDARD_DEDUCTION_2026_SINGLE = 16100;
const STANDARD_DEDUCTION_2026_JOINT = 32200;

const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
    single: STANDARD_DEDUCTION_2026_SINGLE,
    mfj: STANDARD_DEDUCTION_2026_JOINT,
    qss: STANDARD_DEDUCTION_2026_JOINT,
    mfs: STANDARD_DEDUCTION_2026_SINGLE,
    hoh: 24150,
};

// 2026 Long-Term Capital Gains Brackets (IRC § 1(h) / § 1(j)(5))
const LTCG_BRACKETS_2026_SINGLE: TaxBrackets = [
    { rate: 0.00, until: 49450 },
    { rate: 0.15, until: 545500 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2026_JOINT: TaxBrackets = [
    { rate: 0.00, until: 98900 },
    { rate: 0.15, until: 613700 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2026_MFS: TaxBrackets = [
    { rate: 0.00, until: 49450 },
    { rate: 0.15, until: 306850 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2026_HOH: TaxBrackets = [
    { rate: 0.00, until: 66200 },
    { rate: 0.15, until: 579600 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2026: Record<FilingStatus, TaxBrackets> = {
    single: LTCG_BRACKETS_2026_SINGLE,
    mfj: LTCG_BRACKETS_2026_JOINT,
    qss: LTCG_BRACKETS_2026_JOINT,
    mfs: LTCG_BRACKETS_2026_MFS,
    hoh: LTCG_BRACKETS_2026_HOH,
};

// 2027 Ordinary Brackets & Standard Deductions (Rev. Proc. 2026-35)
const BRACKETS_2027_SINGLE: TaxBrackets = [
    { rate: 0.10, until: 12800 },
    { rate: 0.12, until: 52025 },
    { rate: 0.22, until: 109125 },
    { rate: 0.24, until: 208325 },
    { rate: 0.32, until: 264550 },
    { rate: 0.35, until: 661375 },
    { rate: 0.37, until: Infinity },
];

const BRACKETS_2027_JOINT: TaxBrackets = [
    { rate: 0.10, until: 25600 },
    { rate: 0.12, until: 104050 },
    { rate: 0.22, until: 218250 },
    { rate: 0.24, until: 416650 },
    { rate: 0.32, until: 529100 },
    { rate: 0.35, until: 793650 },
    { rate: 0.37, until: Infinity },
];

const BRACKETS_2027_MFS: TaxBrackets = [
    { rate: 0.10, until: 12800 },
    { rate: 0.12, until: 52025 },
    { rate: 0.22, until: 109125 },
    { rate: 0.24, until: 208325 },
    { rate: 0.32, until: 264550 },
    { rate: 0.35, until: 396825 },
    { rate: 0.37, until: Infinity },
];

const BRACKETS_2027_HOH: TaxBrackets = [
    { rate: 0.10, until: 18250 },
    { rate: 0.12, until: 69650 },
    { rate: 0.22, until: 109100 },
    { rate: 0.24, until: 208300 },
    { rate: 0.32, until: 264550 },
    { rate: 0.35, until: 661350 },
    { rate: 0.37, until: Infinity },
];

const BRACKETS_2027: Record<FilingStatus, TaxBrackets> = {
    single: BRACKETS_2027_SINGLE,
    mfj: BRACKETS_2027_JOINT,
    qss: BRACKETS_2027_JOINT,
    mfs: BRACKETS_2027_MFS,
    hoh: BRACKETS_2027_HOH,
};

const STANDARD_DEDUCTION_2027_SINGLE = 16600;
const STANDARD_DEDUCTION_2027_JOINT = 33200;

const STANDARD_DEDUCTION_2027: Record<FilingStatus, number> = {
    single: STANDARD_DEDUCTION_2027_SINGLE,
    mfj: STANDARD_DEDUCTION_2027_JOINT,
    qss: STANDARD_DEDUCTION_2027_JOINT,
    mfs: STANDARD_DEDUCTION_2027_SINGLE,
    hoh: 24925,
};

// 2027 Long-Term Capital Gains Brackets (Rev. Proc. 2026-35 § 3.03)
const LTCG_BRACKETS_2027_SINGLE: TaxBrackets = [
    { rate: 0.00, until: 51050 },
    { rate: 0.15, until: 563200 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2027_JOINT: TaxBrackets = [
    { rate: 0.00, until: 102100 },
    { rate: 0.15, until: 633600 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2027_MFS: TaxBrackets = [
    { rate: 0.00, until: 51050 },
    { rate: 0.15, until: 316800 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2027_HOH: TaxBrackets = [
    { rate: 0.00, until: 68350 },
    { rate: 0.15, until: 598400 },
    { rate: 0.20, until: Infinity },
];

const LTCG_BRACKETS_2027: Record<FilingStatus, TaxBrackets> = {
    single: LTCG_BRACKETS_2027_SINGLE,
    mfj: LTCG_BRACKETS_2027_JOINT,
    qss: LTCG_BRACKETS_2027_JOINT,
    mfs: LTCG_BRACKETS_2027_MFS,
    hoh: LTCG_BRACKETS_2027_HOH,
};

interface YearSharedConfig {
    aotcByStatus: Partial<Record<FilingStatus, AotcRules>>;
    capitalGainsBracketsByStatus: Record<FilingStatus, TaxBrackets>;
    dependentStandardDeduction: NonNullable<TaxRules["dependentStandardDeduction"]>;
    kiddieTax: NonNullable<TaxRules["kiddieTax"]>;
    saltCap?: number;
}

const YEAR_SHARED_CONFIG: Record<FederalTaxYear, YearSharedConfig> = {
    2026: {
        aotcByStatus: AOTC_RULES_BY_STATUS_2009,
        capitalGainsBracketsByStatus: LTCG_BRACKETS_2026,
        dependentStandardDeduction: { base: 1350, earnedAddOn: 450 },
        kiddieTax: { unearnedIncomeThreshold: 2700, itemizedBase: 1350 },
    },
    2027: {
        aotcByStatus: AOTC_RULES_BY_STATUS_2009,
        capitalGainsBracketsByStatus: LTCG_BRACKETS_2027,
        dependentStandardDeduction: { base: 1400, earnedAddOn: 500 },
        kiddieTax: { unearnedIncomeThreshold: 2800, itemizedBase: 1400 },
    },
};

function buildYearRules(
    year: FederalTaxYear,
    bracketsByStatus: Record<FilingStatus, TaxBrackets>,
    standardDeductionByStatus: Record<FilingStatus, number>,
): Record<FilingStatus, FederalTaxRules> {
    const shared = YEAR_SHARED_CONFIG[year];
    const statuses: FilingStatus[] = ["single", "mfj", "qss", "mfs", "hoh"];
    const entries = statuses.map((status) => {
        const rules: FederalTaxRules = {
            aotc: shared.aotcByStatus[status],
            brackets: bracketsByStatus[status],
            capitalGainsBrackets: shared.capitalGainsBracketsByStatus[status],
            standardDeduction: standardDeductionByStatus[status],
            dependentStandardDeduction: shared.dependentStandardDeduction,
            kiddieTax: shared.kiddieTax,
            saltCap: shared.saltCap,
        };
        return [status, rules] as const;
    });

    return Object.fromEntries(entries) as Record<FilingStatus, FederalTaxRules>;
}

/**
 * Map from tax year to map of filing status to FederalTaxRules for that combination.
 */
export const FederalRules: Record<FederalTaxYear, Record<FilingStatus, FederalTaxRules>> = {
    2026: buildYearRules(2026, BRACKETS_2026, STANDARD_DEDUCTION_2026),
    2027: buildYearRules(2027, BRACKETS_2027, STANDARD_DEDUCTION_2027),
};
