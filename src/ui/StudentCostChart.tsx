import {memo, useDeferredValue, useMemo} from "react";
import {CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,} from "recharts";
import {Translator} from "./i18n.js";

export type StudentCostChartPoint = {
    qualifiedExpenses: number;
    cost: number;
    credit: number;
    outOfScopeForVITA: boolean;
};

export type StudentCostChartProps = {
    points: readonly StudentCostChartPoint[];
    t: Translator;
    height?: number;
};

const COST_COLOR = "#2563eb";
const CREDIT_COLOR = "#0d9488";

const formatCurrency = (value: number): string =>
    `$${Math.round(value).toLocaleString("en-US")}`;

function niceStep(rawSpan: number, targetTicks = 5): number {
    const rough = Math.max(1, rawSpan) / Math.max(1, targetTicks - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;

    let niceMult = 1;
    if (normalized > 5) {
        niceMult = 10;
    } else if (normalized > 2) {
        niceMult = 5;
    } else if (normalized > 1) {
        niceMult = 2;
    }

    return Math.max(1, niceMult * magnitude);
}

// exported for testing
export function buildRoundTicks(min: number, max: number, targetTicks = 5): number[] {
    if (max <= min) {
        return [Math.round(min)];
    }

    const step = niceStep(max - min, targetTicks);
    const eps = step * 1e-9;

    // Anchor at 0 when 0 is within [min, max]; otherwise start at a multiple of step.
    const anchor = min <= 0 && 0 <= max ? 0 : Math.ceil((min - eps) / step) * step;

    const ticks: number[] = [];

    // Step downward from anchor if needed.
    for (let v = anchor - step; v >= min - eps; v -= step) {
        ticks.push(Math.round(v));
    }
    ticks.reverse();

    // Step upward from anchor through max.
    for (let v = anchor; v <= max + eps; v += step) {
        ticks.push(Math.round(v));
    }

    // Deduplicate (e.g. -0 vs 0) and keep strictly within [min, max].
    return Array.from(new Set(ticks)).filter(
        (t) => t >= Math.floor(min - eps) && t <= Math.ceil(max + eps),
    );
}

// exported for testing
export function computeAlignedDomains(points: readonly StudentCostChartPoint[]): {
    costDomain: [number, number];
    creditDomain: [number, number];
    costTicks: number[];
    creditTicks: number[];
} {
    if (points.length === 0) {
        return {
            costDomain: [0, 100],
            creditDomain: [0, 100],
            costTicks: buildRoundTicks(0, 100),
            creditTicks: buildRoundTicks(0, 100),
        };
    }

    let minCost = Infinity;
    let maxCost = -Infinity;
    let minCredit = Infinity;
    let maxCredit = -Infinity;
    let maxNetBenefit = -Infinity;

    for (const pt of points) {
        if (pt.cost < minCost) minCost = pt.cost;
        if (pt.cost > maxCost) maxCost = pt.cost;
        if (pt.credit < minCredit) minCredit = pt.credit;
        if (pt.credit > maxCredit) maxCredit = pt.credit;
        const net = pt.credit - pt.cost;
        if (net > maxNetBenefit) maxNetBenefit = net;
    }

    // In the shared vertical coordinate y = cost = credit - maxNetBenefit:
    // - Cost spans [minCost, maxCost]
    // - Shifted credit spans [minCredit - maxNetBenefit, maxCredit - maxNetBenefit]
    const sharedMinRaw = Math.min(minCost, minCredit - maxNetBenefit);
    const sharedMaxRaw = Math.max(maxCost, maxCredit - maxNetBenefit);
    const rawSpan = Math.max(10, sharedMaxRaw - sharedMinRaw);
    const pad = 0.06 * rawSpan;

    const costMin = sharedMinRaw - pad;
    const costMax = sharedMaxRaw + pad;
    const creditMin = costMin + maxNetBenefit;
    const creditMax = costMax + maxNetBenefit;

    return {
        costDomain: [costMin, costMax],
        creditDomain: [creditMin, creditMax],
        costTicks: buildRoundTicks(costMin, costMax),
        creditTicks: buildRoundTicks(creditMin, creditMax),
    };
}

export const StudentCostChart = memo(function StudentCostChart({
                                                                   points,
                                                                   t,
                                                                   height = 280,
                                                               }: StudentCostChartProps) {
    const deferredPoints = useDeferredValue(points);
    const isStale = deferredPoints !== points;
    const costLabel = t("chartCostLabel");
    const creditLabel = t("chartCreditLabel");
    const xAxisLabel = t("chartXAxisLabel");

    const {chartData, costDomain, creditDomain, costTicks, creditTicks} = useMemo(() => {
        const mapped = deferredPoints.map((pt) => ({
            qualifiedExpenses: pt.qualifiedExpenses,
            cost: pt.cost,
            credit: pt.credit,
            outOfScopeForVITA: pt.outOfScopeForVITA,
        }));
        const domains = computeAlignedDomains(deferredPoints);
        return {chartData: mapped, ...domains};
    }, [deferredPoints]);

    return (
        <div
            data-stale={isStale ? "true" : "false"}
            style={{
                width: "100%",
                height,
                opacity: isStale ? 0.75 : 1,
                transition: "opacity 120ms ease",
            }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{top: 16, right: 32, left: 24, bottom: 28}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis
                        dataKey="qualifiedExpenses"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={formatCurrency}
                        label={{
                            value: xAxisLabel,
                            position: "insideBottom",
                            offset: -16,
                            style: {textAnchor: "middle"},
                        }}
                    />
                    <YAxis
                        yAxisId="cost"
                        domain={costDomain}
                        ticks={costTicks}
                        allowDataOverflow
                        tickFormatter={formatCurrency}
                        stroke={COST_COLOR}
                        tick={{fill: COST_COLOR, fontSize: 12}}
                        width={92}
                        label={{
                            value: costLabel,
                            angle: -90,
                            position: "insideLeft",
                            fill: COST_COLOR,
                            style: {textAnchor: "middle"},
                        }}
                    />
                    <YAxis
                        yAxisId="credit"
                        orientation="right"
                        domain={creditDomain}
                        ticks={creditTicks}
                        allowDataOverflow
                        tickFormatter={formatCurrency}
                        stroke={CREDIT_COLOR}
                        tick={{fill: CREDIT_COLOR, fontSize: 12}}
                        width={92}
                        label={{
                            value: creditLabel,
                            angle: 90,
                            position: "insideRight",
                            fill: CREDIT_COLOR,
                            style: {textAnchor: "middle"},
                        }}
                    />
                    <Tooltip
                        formatter={(value, name) => [
                            typeof value === "number" ? formatCurrency(value) : String(value ?? ""),
                            String(name ?? ""),
                        ]}
                        labelFormatter={(label) => `${xAxisLabel}: ${formatCurrency(Number(label))}`}
                    />
                    <Legend position="top" height={28} itemSorter={null}/>
                    <Line
                        yAxisId="cost"
                        type="monotone"
                        dataKey="cost"
                        name={costLabel}
                        stroke={COST_COLOR}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        yAxisId="credit"
                        type="monotone"
                        dataKey="credit"
                        name={creditLabel}
                        stroke={CREDIT_COLOR}
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={false}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
});
