import {cleanup, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AotcResult} from "../../src/ui/AotcResult.js";
import {FederalRules} from "../../src/rules/federal.js";
import type {StudentExpenseCost} from "../../src/calc/optimizeAotc.js";
import type {AotcInput} from "../../src/calc/calculateAotc.js";
import {makePigLatinTranslator} from "./pigLatin.js";

afterEach(() => {
    cleanup();
});

const rules2026Mfj = FederalRules[2026].mfj!;

function defaultProps(
    overrides: Partial<Parameters<typeof AotcResult>[0]> = {},
) {
    return {
        stayWithinVitaScope: false,
        claimantTaxRules: rules2026Mfj,
        claimantRefundableIneligible: false,
        claimantAgi: 80_000,
        claimantTaxBeforeNonrefundableCredits: 10_000,
        claimantNonrefundableCredits: 2_000,
        studentNames: ["Honoria"],
        studentExpenseCosts: [
            [
                {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                {qualifiedExpenses: 2_000, cost: 200, outOfScopeForVITA: false},
                {qualifiedExpenses: 4_000, cost: 800, outOfScopeForVITA: false},
            ],
        ] as readonly (readonly StudentExpenseCost[])[],
        setOptimalAotcInputs: vi.fn<(nextInputs: AotcInput) => void>(),
        t: makePigLatinTranslator(),
        ...overrides,
    };
}

describe("AotcResult", () => {
    it("renders per-student qualified expenses, incremental cost, and household summary in whole dollars", () => {
        const props = defaultProps();
        render(<AotcResult {...props} />);

        const section = screen.getByRole("region", {name: "Esultsray"});
        const items = within(section).getAllByRole("listitem");
        expect(items).toHaveLength(1);
        expect(items[0].textContent).toContain("Honoria");
        expect(items[0].textContent).toContain("Ualifiedqay expensesyay");
        expect(items[0].textContent).toContain("$2,000");
        expect(items[0].textContent).toContain("Incrementalyay ostcay");
        expect(items[0].textContent).toContain("$200");

        expect(section.textContent).toContain("Usableyay AOTC-ay: $2,000");
        expect(section.textContent).not.toContain("Unusableyay onrefundablenay editscray");
        expect(section.textContent).toContain("Otaltay incrementalyay ostcay: $200");
        expect(section.textContent).toContain("Etnay enefitbay: $1,800");
    });

    it("computes incremental cost relative to baseline expense cost across multiple students", () => {
        const props = defaultProps({
            studentNames: ["Honoria", "Bertie"],
            studentExpenseCosts: [
                [
                    {qualifiedExpenses: 0, cost: 300, outOfScopeForVITA: false},
                    {qualifiedExpenses: 4_000, cost: 1_100, outOfScopeForVITA: false},
                ],
                [
                    {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                ],
            ],
        });

        render(<AotcResult {...props} />);

        const section = screen.getByRole("region", {name: "Esultsray"});
        const items = within(section).getAllByRole("listitem");
        expect(items[0].textContent).toContain("Honoria");
        expect(items[0].textContent).toContain("Incrementalyay ostcay $800");
        expect(items[1].textContent).toContain("Bertie");
        expect(items[1].textContent).toContain("Incrementalyay ostcay $0");
        expect(section.textContent).toContain("Otaltay incrementalyay ostcay: $800");
        expect(section.textContent).toContain("Etnay enefitbay: $1,700");
    });

    it("computes tax headroom internally and shows unusable nonrefundable credit only when nonzero", () => {
        const props = defaultProps({
            claimantRefundableIneligible: true,
            claimantTaxBeforeNonrefundableCredits: 2_500,
            claimantNonrefundableCredits: 2_000,
            studentExpenseCosts: [
                [
                    {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                    {qualifiedExpenses: 4_000, cost: 0, outOfScopeForVITA: false},
                ],
            ],
        });

        render(<AotcResult {...props} />);

        const section = screen.getByRole("region", {name: "Esultsray"});
        expect(section.textContent).toContain("Usableyay AOTC-ay: $500");
        expect(section.textContent).toContain("Unusableyay onrefundablenay editscray: $2,000");
        expect(section.textContent).toContain("Otaltay incrementalyay ostcay: $0");
        expect(section.textContent).toContain("Etnay enefitbay: $500");
    });

    it("skips TaxError candidates during optimization and falls back to baseline qualified expenses", () => {
        const errorCandidate = {
            qualifiedExpenses: 4_000,
            errorCode: "OUT_OF_RANGE",
        } as unknown as StudentExpenseCost;

        const props = defaultProps({
            studentNames: ["Honoria"],
            studentExpenseCosts: [
                [
                    {qualifiedExpenses: 0, cost: 250, outOfScopeForVITA: false},
                    errorCandidate,
                ],
            ],
        });

        render(<AotcResult {...props} />);

        const section = screen.getByRole("region", {name: "Esultsray"});
        const item = within(section).getByRole("listitem");
        expect(item.textContent).toContain("$0");
        expect(item.textContent).toContain("Incrementalyay ostcay $0");
        expect(section.textContent).toContain("Usableyay AOTC-ay: $0");
        expect(section.textContent).toContain("Otaltay incrementalyay ostcay: $0");
        expect(section.textContent).toContain("Etnay enefitbay: $0");
    });

    it("emits optimal AOTC inputs once per distinct result and re-emits when inputs change", () => {
        const setOptimalAotcInputs = vi.fn<(nextInputs: AotcInput) => void>();
        const props = defaultProps({
            studentNames: ["Honoria"],
            setOptimalAotcInputs,
        });

        const {rerender} = render(<AotcResult {...props} />);
        expect(setOptimalAotcInputs).toHaveBeenCalledTimes(1);
        expect(setOptimalAotcInputs).toHaveBeenLastCalledWith({
            agi: 80_000,
            refundableIneligible: false,
            students: [{qualifiedExpenses: 2_000}],
        });

        rerender(<AotcResult {...props} />);
        expect(setOptimalAotcInputs).toHaveBeenCalledTimes(1);

        rerender(
            <AotcResult
                {...props}
                claimantRefundableIneligible={true}
                claimantTaxBeforeNonrefundableCredits={2_000}
                claimantNonrefundableCredits={2_000}
            />,
        );
        expect(setOptimalAotcInputs).toHaveBeenCalledTimes(2);
        expect(setOptimalAotcInputs).toHaveBeenLastCalledWith({
            agi: 80_000,
            refundableIneligible: true,
            students: [{qualifiedExpenses: 0}],
        });
    });

    it("respects stayWithinVitaScope when selecting optimal expenses", () => {
        const props = defaultProps({
            studentNames: ["Honoria"],
            stayWithinVitaScope: true,
            studentExpenseCosts: [
                [
                    {qualifiedExpenses: 0, cost: 0, outOfScopeForVITA: false},
                    {qualifiedExpenses: 4_000, cost: 0, outOfScopeForVITA: true},
                ],
            ],
        });

        render(<AotcResult {...props} />);

        const section = screen.getByRole("region", {name: "Esultsray"});
        expect(within(section).getByRole("listitem").textContent).toContain("$0");
        expect(section.textContent).toContain("Usableyay AOTC-ay: $0");
        expect(section.textContent).toContain("Otaltay incrementalyay ostcay: $0");
        expect(section.textContent).toContain("Etnay enefitbay: $0");
    });

    it("propagates updated studentNames into the rendered results", () => {
        const props = defaultProps({
            studentNames: ["Honoria"],
        });

        const {rerender} = render(<AotcResult {...props} />);
        let section = screen.getByRole("region", {name: "Esultsray"});
        expect(within(section).getAllByRole("listitem")[0].textContent).toContain("Honoria");

        rerender(
            <AotcResult
                {...props}
                studentNames={["Bertie"]}
            />,
        );
        section = screen.getByRole("region", {name: "Esultsray"});
        expect(within(section).getAllByRole("listitem")[0].textContent).toContain("Bertie");
        expect(within(section).getAllByRole("listitem")[0].textContent).not.toContain("Honoria");
    });
});
