import {FederalTaxYear} from "./federal.js";

export type FederalLineKind = "form" | "schedule";

export interface FormLineRef {
    kind: FederalLineKind;
    form: string;
    line: string;
}

export interface FederalLineRevision {
    agi: FormLineRef;
    taxableIncome: FormLineRef;
}

export const FEDERAL_LINE_REVISIONS: Record<number, FederalLineRevision> = {
    2026: {
        agi: {kind: "form", form: "1040", line: "11"},
        taxableIncome: {kind: "form", form: "1040", line: "15"},
    },
    // Example if AGI moves to a schedule in a later revision:
    // 2027: {
    //     agi: {kind: "schedule", form: "1", line: "11"},
    //     taxableIncome: {kind: "form", form: "1040", line: "15"},
    // },
};

export function getFederalLineRevision(taxYear: FederalTaxYear): FederalLineRevision {
    const revisionYears = Object.keys(FEDERAL_LINE_REVISIONS)
        .map(Number)
        .filter((year) => year <= taxYear)
        .sort((a, b) => b - a);

    if (revisionYears.length === 0) {
        throw new Error(`No federal line revision available for tax year ${taxYear}`);
    }

    return FEDERAL_LINE_REVISIONS[revisionYears[0]];
}