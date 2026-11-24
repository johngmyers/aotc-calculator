import {useEffect, useId, useMemo, useRef} from "react";
import {type AotcInput, calculateAotc, type FederalTaxRules} from "../calc/calculateAotc.js";
import {optimizeAotc, type StudentExpenseCost} from "../calc/optimizeAotc.js";
import {formatWholeDollars} from "./formatWholeDollars.js";
import type {Translator} from "./i18n.js";

export type AotcResultProps = {
    stayWithinVitaScope: boolean;
    claimantTaxRules: FederalTaxRules;
    claimantRefundableIneligible: boolean;
    claimantAgi: number;
    claimantTaxBeforeNonrefundableCredits: number;
    claimantNonrefundableCredits: number;
    studentNames: readonly string[];
    studentExpenseCosts: readonly (readonly StudentExpenseCost[])[];
    setOptimalAotcInputs: (nextInputs: AotcInput) => void;
    t: Translator;
};

export function AotcResult({
                               stayWithinVitaScope,
                               claimantTaxRules,
                               claimantRefundableIneligible,
                               claimantAgi,
                               claimantTaxBeforeNonrefundableCredits,
                               claimantNonrefundableCredits,
                               studentNames,
                               studentExpenseCosts,
                               setOptimalAotcInputs,
                               t,
                           }: AotcResultProps) {
    const headingId = useId();
    const lastEmittedInputsKeyRef = useRef<string>("");

    const evaluation = useMemo(() => {
        const tiMinusNonrefundable =
            claimantTaxBeforeNonrefundableCredits - claimantNonrefundableCredits;

        const baseInput: AotcInput = {
            agi: claimantAgi,
            refundableIneligible: claimantRefundableIneligible,
            students: [],
        };

        const optimalInput = optimizeAotc({
            rules: claimantTaxRules,
            tiMinusNonrefundable,
            stayWithinVitaScope,
            input: baseInput,
            expenseCosts: studentExpenseCosts,
        });

        const aotcResult = calculateAotc(claimantTaxRules, optimalInput);
        const usableTaxHeadroom = Math.max(0, tiMinusNonrefundable);
        const usableCredit =
            aotcResult.refundableCredit +
            Math.min(usableTaxHeadroom, aotcResult.nonrefundableCredit);
        const unusableNonrefundableCredit = Math.max(
            0,
            aotcResult.nonrefundableCredit - usableTaxHeadroom,
        );

        const perStudent = optimalInput.students.map((optStudent, i) => {
            const candidates = studentExpenseCosts[i];
            const baseline = candidates[0];
            const chosen = candidates.find(
                (c) => c.qualifiedExpenses === optStudent.qualifiedExpenses,
            );

            const baseCost = baseline && !("errorCode" in baseline) ? baseline.cost : 0;
            const chosenCost = chosen && !("errorCode" in chosen) ? chosen.cost : 0;

            return {
                studentName: studentNames[i],
                qualifiedExpenses: optStudent.qualifiedExpenses,
                cost: chosenCost,
                incrementalCost: chosenCost - baseCost,
            };
        });

        const totalIncrementalCost = perStudent.reduce((sum, s) => sum + s.incrementalCost, 0);
        const netBenefit = usableCredit - totalIncrementalCost;

        return {
            optimalInput,
            perStudent,
            usableCredit,
            unusableNonrefundableCredit,
            totalIncrementalCost,
            netBenefit,
        };
    }, [
        stayWithinVitaScope,
        claimantTaxRules,
        claimantRefundableIneligible,
        claimantAgi,
        claimantTaxBeforeNonrefundableCredits,
        claimantNonrefundableCredits,
        studentNames,
        studentExpenseCosts,
    ]);

    useEffect(() => {
        const serialized = JSON.stringify({
            claimantTaxRules,
            optimalInput: evaluation.optimalInput,
        });
        if (lastEmittedInputsKeyRef.current === serialized) {
            return;
        }
        lastEmittedInputsKeyRef.current = serialized;
        setOptimalAotcInputs(evaluation.optimalInput);
    }, [evaluation, claimantTaxRules, setOptimalAotcInputs]);

    return (
        <section aria-labelledby={headingId}>
            <h2 id={headingId}>
                <center>{t("resultsSectionTitle")}</center>
            </h2>
            <ul>
                {evaluation.perStudent.map((student, idx) => (
                    <li key={idx}>
                        <strong>{student.studentName}</strong>: {t("resultsQualifiedExpenses")}{" "}
                        {formatWholeDollars(student.qualifiedExpenses)}, {t("resultsIncrementalCost")}{" "}
                        {formatWholeDollars(student.incrementalCost)}
                    </li>
                ))}
            </ul>
            <div>
                <p>
                    {t("resultsUsableAotc")}: {formatWholeDollars(evaluation.usableCredit)}
                </p>
                {evaluation.unusableNonrefundableCredit > 0 && (
                    <p>
                        {t("resultsUnusableCredits")}:{" "}
                        {formatWholeDollars(evaluation.unusableNonrefundableCredit)}
                    </p>
                )}
                <p>
                    {t("resultsTotalIncrementalCost")}: {formatWholeDollars(evaluation.totalIncrementalCost)}
                </p>
                <p>
                    {t("resultsNetBenefit")}: {formatWholeDollars(evaluation.netBenefit)}
                </p>
            </div>
        </section>
    );
}
