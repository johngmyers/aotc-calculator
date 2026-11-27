import {FederalTaxYear} from "./federal.js";

export type FederalLineKind = "form" | "schedule";

export type FormLineRef = {
    kind: FederalLineKind
    form: string
    line: string
}

export type FormLineRefs = {
    additive?: boolean
    refs: readonly FormLineRef[]
}

export type FederalLineRevision = {
    agi: FormLineRefs
    ltcg: FormLineRefs
    medicalExpenses: FormLineRefs
    salt: FormLineRefs
    otherItemizedExpenses: FormLineRefs
    taxBeforeNonrefundableCredits: FormLineRefs
    nonrefundableCredits: FormLineRefs
}

export const FEDERAL_LINE_REVISIONS: Record<number, FederalLineRevision> = {
    2026: {
        agi: {
            refs: [
                {kind: "form", form: "1040", line: "11"},
                {kind: "form", form: "1040-SR", line: "11"},
            ],
        },
        ltcg: {
            refs: [
                {kind: "form", form: "1040", line: "7a"},
                {kind: "form", form: "1040-SR", line: "7a"},
            ],
        },
        medicalExpenses: {
            refs: [
                {kind: "schedule", form: "A", line: "1"},
            ],
        },
        salt: {
            refs: [
                {kind: "schedule", form: "A", line: "5d"},
            ],
        },
        otherItemizedExpenses: {
            additive: true,
            refs: [
                {kind: "schedule", form: "A", line: "10"},
                {kind: "schedule", form: "A", line: "15"},
                {kind: "schedule", form: "A", line: "16"},
            ],
        },
        taxBeforeNonrefundableCredits: {
            refs: [
                {kind: "form", form: "1040", line: "18"},
                {kind: "form", form: "1040-SR", line: "18"},
            ],
        },
        nonrefundableCredits: {
            refs: [
                {kind: "form", form: "1040", line: "21"},
                {kind: "form", form: "1040-SR", line: "21"},
            ],
        },
    },
    // Example if AGI moves to a schedule in a later revision:
    // 2027: {
    //     agi: [
    //         {kind: "schedule", form: "1", line: "11"},
    //         {kind: "form", form: "1040-SR", line: "11a"},
    //     ],
    //     ...
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