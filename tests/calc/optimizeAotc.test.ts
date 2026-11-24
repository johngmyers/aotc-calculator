import {describe, expect, it} from "vitest";
import {FederalRules} from "../../src/rules/federal.js";
import {
    areStudentExpenseCostsEqual,
    optimizeAotc,
    type OptimizeAotcParams,
    type StudentExpenseCost,
} from "../../src/calc/optimizeAotc.js";

const rules2026 = FederalRules[2026].mfj!;

function baseParams(
    overrides: Partial<OptimizeAotcParams> = {},
): OptimizeAotcParams {
    return {
        rules: rules2026,
        tiMinusNonrefundable: 5000,
        stayWithinVitaScope: false,
        input: {
            agi: 80_000,
            refundableIneligible: false,
            students: [{qualifiedExpenses: 0}],
        },
        expenseCosts: [
            [
                {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                {qualifiedExpenses: 2000, cost: 0, outOfScopeForVITA: false},
                {qualifiedExpenses: 4000, cost: 0, outOfScopeForVITA: false},
            ],
        ],
        ...overrides,
    };
}

describe("areStudentExpenseCostsEqual", () => {
    it("returns true for identical valid and error entries and false on differences", () => {
        const a: StudentExpenseCost[] = [
            {qualifiedExpenses: 1000, cost: 200, outOfScopeForVITA: false},
            {
                qualifiedExpenses: 2000,
                errorCode: "ERR_TEST",
                errorMessage: "boom",
            } as StudentExpenseCost,
        ];
        const b: StudentExpenseCost[] = [
            {qualifiedExpenses: 1000, cost: 200, outOfScopeForVITA: false},
            {
                qualifiedExpenses: 2000,
                errorCode: "ERR_TEST",
                errorMessage: "boom",
            } as StudentExpenseCost,
        ];

        expect(areStudentExpenseCostsEqual(a, b)).toBe(true);
        expect(areStudentExpenseCostsEqual(a, b.slice(0, 1))).toBe(false);
        expect(
            areStudentExpenseCostsEqual(a, [
                {qualifiedExpenses: 1000, cost: 250, outOfScopeForVITA: false},
                b[1],
            ]),
        ).toBe(false);
    });

    it("returns false when comparing a TaxError entry against a non-error entry", () => {
        const errPoint = {
            qualifiedExpenses: 1000,
            errorCode: "E1",
            errorMessage: "fail",
        } as StudentExpenseCost;
        const okPoint: StudentExpenseCost = {
            qualifiedExpenses: 1000,
            cost: 0,
            outOfScopeForVITA: false,
        };

        expect(areStudentExpenseCostsEqual([errPoint], [okPoint])).toBe(false);
    });
});

describe("optimizeAotc", () => {
    it("selects qualifiedExpenses maximizing credit minus cost", () => {
        const res = optimizeAotc(
            baseParams({
                expenseCosts: [
                    [
                        {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                        {qualifiedExpenses: 2000, cost: 500, outOfScopeForVITA: false},
                        {qualifiedExpenses: 4000, cost: 1500, outOfScopeForVITA: false},
                    ],
                ],
            }),
        );

        expect(res.students).toEqual([{qualifiedExpenses: 2000}]);
    });

    it("skips out-of-scope options when stayWithinVitaScope is true", () => {
        const res = optimizeAotc(
            baseParams({
                stayWithinVitaScope: true,
                expenseCosts: [
                    [
                        {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                        {qualifiedExpenses: 4000, cost: 0, outOfScopeForVITA: true},
                    ],
                ],
            }),
        );

        expect(res.students).toEqual([{qualifiedExpenses: 0}]);
    });

    it("allows out-of-scope options when stayWithinVitaScope is false", () => {
        const res = optimizeAotc(
            baseParams({
                stayWithinVitaScope: false,
                expenseCosts: [
                    [
                        {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                        {qualifiedExpenses: 4000, cost: 0, outOfScopeForVITA: true},
                    ],
                ],
            }),
        );

        expect(res.students).toEqual([{qualifiedExpenses: 4000}]);
    });

    it("ignores TaxError entries during candidate evaluation", () => {
        const res = optimizeAotc(
            baseParams({
                expenseCosts: [
                    [
                        {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                        {
                            qualifiedExpenses: 4000,
                            errorCode: "CALC_ERR",
                            errorMessage: "invalid",
                        } as StudentExpenseCost,
                        {qualifiedExpenses: 2000, cost: 0, outOfScopeForVITA: false},
                    ],
                ],
            }),
        );

        expect(res.students).toEqual([{qualifiedExpenses: 2000}]);
    });

    it("clamps negative tiMinusNonrefundable to zero", () => {
        const negative = optimizeAotc(baseParams({tiMinusNonrefundable: -2500}));
        const zeroed = optimizeAotc(baseParams({tiMinusNonrefundable: 0}));

        expect(negative.students).toEqual(zeroed.students);
    });

    it("does not mutate the input object or its students array", () => {
        const params = baseParams({
            input: {
                agi: 80_000,
                refundableIneligible: false,
                students: [{qualifiedExpenses: 1234}],
            },
        });
        const snapshot = structuredClone(params);

        optimizeAotc(params);

        expect(params).toEqual(snapshot);
    });

    it("falls back to the first candidate's qualifiedExpenses when all candidates are out of scope", () => {
        const res = optimizeAotc(
            baseParams({
                stayWithinVitaScope: true,
                expenseCosts: [
                    [
                        {qualifiedExpenses: 1500, cost: 200, outOfScopeForVITA: true},
                        {qualifiedExpenses: 4000, cost: 500, outOfScopeForVITA: true},
                    ],
                ],
            }),
        );

        expect(res.students).toEqual([{qualifiedExpenses: 1500}]);
    });

    it("falls back to the first candidate's qualifiedExpenses when all candidates are TaxError entries", () => {
        const res = optimizeAotc(
            baseParams({
                expenseCosts: [
                    [
                        {
                            qualifiedExpenses: 1200,
                            errorCode: "ERR_A",
                            errorMessage: "first failed",
                        } as StudentExpenseCost,
                        {
                            qualifiedExpenses: 3600,
                            errorCode: "ERR_B",
                            errorMessage: "second failed",
                        } as StudentExpenseCost,
                    ],
                ],
            }),
        );

        expect(res.students).toEqual([{qualifiedExpenses: 1200}]);
    });
});