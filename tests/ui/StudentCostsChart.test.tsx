import {Children, cloneElement, isValidElement, type ReactElement, type ReactNode} from "react";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {
    buildRoundTicks,
    computeAlignedDomains,
    StudentCostChart,
    type StudentCostChartPoint,
} from "../../src/ui/StudentCostChart.js";
import {makePigLatinTranslator} from "./pigLatin.js";

afterEach(() => {
    cleanup();
});

// JSDOM reports 0x0 layout boxes, so ResponsiveContainer skips rendering children unless given fixed dimensions.
vi.mock("recharts", async (importOriginal) => {
    const actual = await importOriginal<typeof import("recharts")>();
    return {
        ...actual,
        ResponsiveContainer: ({children}: { children: ReactNode }) => (
            <div style={{width: 800, height: 300}}>
                {Children.map(children, (child) =>
                    isValidElement(child)
                        ? cloneElement(child as ReactElement<{ width?: number; height?: number }>, {
                            width: 800,
                            height: 300,
                        })
                        : child,
                )}
            </div>
        ),
    };
});

const samplePoints: StudentCostChartPoint[] = [
    {qualifiedExpenses: 100, cost: 0, credit: 100, outOfScopeForVITA: false},
    {qualifiedExpenses: 2000, cost: 132, credit: 2000, outOfScopeForVITA: false},
    {qualifiedExpenses: 4000, cost: 352, credit: 2500, outOfScopeForVITA: false},
    {qualifiedExpenses: 5000, cost: 462, credit: 2500, outOfScopeForVITA: false},
];

describe("StudentCostChart", () => {
    const t = makePigLatinTranslator();
    it("renders both series paths and Pig Latin translated axis/legend labels", async () => {
        const {container} = render(<StudentCostChart points={samplePoints} t={t}/>);

        await waitFor(() => {
            expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(2);
        });

        expect(screen.getAllByText(t("chartCostLabel")).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(t("chartCreditLabel")).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(t("chartXAxisLabel"))).toBeTruthy();
    });

    it("does not clip lower AOTC values when maxNetBenefit exceeds minCredit", async () => {
        const t = makePigLatinTranslator();
        const {creditDomain, costDomain, creditTicks} = computeAlignedDomains(samplePoints);
        const minCredit = Math.min(...samplePoints.map((p) => p.credit));
        const maxCredit = Math.max(...samplePoints.map((p) => p.credit));

        expect(creditDomain[0]).toBeLessThanOrEqual(minCredit);
        expect(creditDomain[1]).toBeGreaterThanOrEqual(maxCredit);
        expect(creditTicks[0]).toBeLessThanOrEqual(minCredit);
        expect(creditDomain[1] - creditDomain[0]).toBeCloseTo(costDomain[1] - costDomain[0], 6);

        render(<StudentCostChart points={samplePoints} t={t}/>);

        await waitFor(() => {
            expect(screen.getAllByText("$0").length).toBeGreaterThanOrEqual(1);
        });
    });

    it("handles an empty points array without crashing", async () => {
        const {container} = render(<StudentCostChart points={[]} t={t}/>);

        await waitFor(() => {
            expect(container.querySelector("[data-stale='false']")).toBeTruthy();
        });
    });

    it("settles deferred updates when points prop changes", async () => {
        const {container, rerender} = render(<StudentCostChart points={samplePoints} t={t}/>);

        await waitFor(() => {
            expect(container.querySelector("[data-stale='false']")).toBeTruthy();
        });

        const updatedPoints: StudentCostChartPoint[] = [
            {qualifiedExpenses: 1000, cost: 200, credit: 1000, outOfScopeForVITA: false},
            {qualifiedExpenses: 4000, cost: 500, credit: 2500, outOfScopeForVITA: false},
        ];

        rerender(<StudentCostChart points={updatedPoints} t={t}/>);

        await waitFor(() => {
            expect(container.querySelector("[data-stale='false']")).toBeTruthy();
            expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(2);
        });
    });
});

describe("computeAlignedDomains", () => {
    it("aligns left and right domains with identical spans offset by maxNetBenefit", () => {
        const {costDomain, creditDomain} = computeAlignedDomains(samplePoints);
        const maxNetBenefit = Math.max(...samplePoints.map((p) => p.credit - p.cost));

        const costSpan = costDomain[1] - costDomain[0];
        const creditSpan = creditDomain[1] - creditDomain[0];

        expect(creditSpan).toBeCloseTo(costSpan, 6);
        expect(creditDomain[0] - costDomain[0]).toBeCloseTo(maxNetBenefit, 6);
        expect(creditDomain[1] - costDomain[1]).toBeCloseTo(maxNetBenefit, 6);
    });

    it("does not anchor axes to 0 when values sit well above 0", () => {
        const elevatedPoints: StudentCostChartPoint[] = [
            {qualifiedExpenses: 2000, cost: 8000, credit: 9000, outOfScopeForVITA: false},
            {qualifiedExpenses: 4000, cost: 8500, credit: 10000, outOfScopeForVITA: false},
        ];

        const {costDomain, creditDomain} = computeAlignedDomains(elevatedPoints);
        expect(costDomain[0]).toBeGreaterThan(7000);
        expect(creditDomain[0]).toBeGreaterThan(8500);
    });

    it("returns round ticks on [0, 100] when points is empty", () => {
        const {costDomain, creditDomain, costTicks, creditTicks} = computeAlignedDomains([]);
        expect(costDomain).toEqual([0, 100]);
        expect(creditDomain).toEqual([0, 100]);
        expect(costTicks).toEqual(buildRoundTicks(0, 100));
        expect(creditTicks).toEqual(buildRoundTicks(0, 100));
    });

    it("generates round tick values anchored at 0 when 0 falls inside the domain", () => {
        const ticks = buildRoundTicks(-44, 2600, 5);
        expect(ticks).toContain(0);
        for (const tick of ticks) {
            expect(tick % 500 === 0 || tick % 1000 === 0).toBe(true);
        }
    });
});
