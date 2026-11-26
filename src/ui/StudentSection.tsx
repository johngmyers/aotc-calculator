import {ReactNode, useEffect, useId, useRef, useState} from "react";
import {Translator} from "./i18n.js";
import {wrapNodes} from "./wrapNodes.js";
import {FederalRules, FederalTaxYear, FilingStatus} from "../rules/federal.js";
import {FILING_STATUS_LABEL_KEYS, FILING_STATUS_ORDER} from "./AotcDependentCalculator.js";
import {IntegerInput, valueRequired} from "./IntegerInput.js";
import {HelpTooltip} from "./HelpTooltip.js";
import {calculateTaxes, GrossIncome} from "../calc/calculateTaxes.js";
import {areStudentExpenseCostsEqual, StudentExpenseCost} from "../calc/optimizeAotc.js";
import {getFederalLineRevision} from "../rules/federalLines.js";

export interface StudentSectionProps {
    studentNumber: number
    hidden: boolean
    taxYear: FederalTaxYear
    expensesCap: number
    onNameChange: (name: string) => void
    onExpenseCostsChange: (expenseCosts: StudentExpenseCost[]) => void
    t: Translator
}

function getEffectiveStudentName(
    name: string | undefined,
    studentNumber: number,
    t: Translator,
): string {
    const trimmed = name?.trim();
    return trimmed ? trimmed : t("studentSectionTitle", {number: studentNumber});
}

interface ComputeStudentExpenseCostsProps {
    taxYear: FederalTaxYear
    expensesCap: number
    filingStatus: FilingStatus
    baseGrossIncome: GrossIncome
    minEducationExpenses: number
    maxAdditionalScholarships: number
}

function computeStudentExpenseCosts({
                                        taxYear,
                                        expensesCap,
                                        filingStatus,
                                        baseGrossIncome,
                                        minEducationExpenses,
                                        maxAdditionalScholarships,
                                    }: ComputeStudentExpenseCostsProps): StudentExpenseCost[] {
    const taxRules = FederalRules[taxYear]?.[filingStatus];
    if (!taxRules) {
        return [{
            qualifiedExpenses: 0,
            cost: 0,
            outOfScopeForVITA: false,
        }];
    }

    return Array.from(
        {length: 1 + Math.min(maxAdditionalScholarships, expensesCap)},
        (_, i): StudentExpenseCost => {
            const grossIncome = {
                ...baseGrossIncome,
                agi: baseGrossIncome.agi + i,
                taxableScholarships: (baseGrossIncome.taxableScholarships ?? 0) + i,
            }
            const outcome = calculateTaxes(taxRules, grossIncome);
            if ("errorCode" in outcome) {
                return {
                    qualifiedExpenses: minEducationExpenses + i,
                    ...outcome,
                };
            }
            return {
                qualifiedExpenses: minEducationExpenses + i,
                cost: outcome.tax,
                outOfScopeForVITA: outcome.outOfScopeForVITA,
            }
        });
}

export function StudentSection({
                                   studentNumber,
                                   hidden,
                                   taxYear,
                                   expensesCap,
                                   onNameChange,
                                   onExpenseCostsChange,
                                   t,
                               }: StudentSectionProps) {
    const federalLineRevision = getFederalLineRevision(taxYear)

    const headingId = useId();
    const nameInputId = useId();
    const [rawName, setRawName] = useState("");
    const filingStatusSelectId = useId();
    const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
    const agiId = useId();
    const [agi, setAgi] = useState<number | undefined>(undefined);
    const ltcgId = useId();
    const [ltcg, setLtcg] = useState<number | undefined>(undefined);
    const minTaxableScholarshipsId = useId();
    const [minTaxableScholarships, setMinTaxableScholarships] = useState<number | undefined>(undefined);
    const minEducationExpensesId = useId();
    const [minEducationExpenses, setMinEducationExpenses] = useState<number | undefined>(undefined);
    const maxAdditionalScholarshipsId = useId();
    const [maxAdditionalScholarships, setMaxAdditionalScholarships] = useState<number | undefined>(undefined);

    useEffect(() => {
        onNameChange(getEffectiveStudentName(rawName, studentNumber, t));
    }, [onNameChange, rawName, studentNumber, t]);

    const lastEmittedCostsRef = useRef<StudentExpenseCost[]>([]);

    useEffect(() => {
        const nextPoints = (() => {
            if (agi === undefined) {
                return [];
            }
            const baseGrossIncome = {
                claimedAsDependent: true,
                agi: agi,
                ltcg: ltcg,
                taxableScholarships: minTaxableScholarships ?? 0,
            }
            return computeStudentExpenseCosts({
                taxYear,
                expensesCap,
                filingStatus,
                baseGrossIncome: baseGrossIncome,
                minEducationExpenses: minEducationExpenses ?? 0,
                maxAdditionalScholarships: maxAdditionalScholarships ?? 0,
            });
        })();

        if (!areStudentExpenseCostsEqual(lastEmittedCostsRef.current, nextPoints)) {
            lastEmittedCostsRef.current = nextPoints;
            onExpenseCostsChange(nextPoints);
        }
    }, [
        taxYear,
        expensesCap,
        filingStatus,
        agi,
        ltcg,
        minTaxableScholarships,
        minEducationExpenses,
        maxAdditionalScholarships,
        onExpenseCostsChange,
    ]);

    return wrapNodes(
        "section",
        {
            key: `student-${studentNumber}`,
            "aria-labelledby": headingId,
            hidden,
        },
        (): ReactNode[] => [
            <h2 key="heading" id={headingId}>
                <center>{t("studentSectionTitle", {number: studentNumber})}</center>
            </h2>,
            <div key="name-field">
                <label htmlFor={nameInputId}>{t("studentNameLabel")}</label>{" "}
                <input
                    id={nameInputId}
                    type="text"
                    value={rawName}
                    onChange={(e) => setRawName(e.target.value)}
                />
            </div>,
            <div key="filing-status">
                <label htmlFor={filingStatusSelectId}>{t("filingStatusLabel")}</label>{" "}
                <select
                    id={filingStatusSelectId}
                    value={filingStatus}
                    onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
                >
                    {FILING_STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                            {t(FILING_STATUS_LABEL_KEYS[status])}
                        </option>
                    ))}
                </select>
            </div>,
            <div key="agi">
                <label htmlFor={agiId}>{t("agiLabel")}</label>
                <span className="required-indicator" aria-hidden="true">*</span>
                {" "}
                <IntegerInput
                    id={agiId}
                    value={agi}
                    onValueChange={setAgi}
                    validator={valueRequired}
                />
                {" "}
                <HelpTooltip
                    t={t}
                    lineRefs={federalLineRevision.agi}
                />
            </div>,
            <div key="ltcg">
                <label htmlFor={ltcgId}>{t("ltcgLabel")}</label>
                {" "}
                <IntegerInput
                    id={ltcgId}
                    value={ltcg}
                    allowNegative={true}
                    onValueChange={setLtcg}
                />
                {" "}
                <HelpTooltip
                    t={t}
                    lineRefs={federalLineRevision.ltcg}
                />
            </div>,
            <div key="taxable-scholarships">
                <label htmlFor={minTaxableScholarshipsId}>{t("studentMinimumTaxableScholarshipsLabel")}</label>
                {" "}
                <IntegerInput
                    id={minTaxableScholarshipsId}
                    value={minTaxableScholarships}
                    onValueChange={setMinTaxableScholarships}
                />
                {" "}
                <HelpTooltip t={t} textKey="studentMinimumTaxableScholarshipsTooltip"/>
            </div>,
            <div key="education-expenses">
                <label htmlFor={minEducationExpensesId}>{t("studentMinimumEducationExpensesLabel")}</label>
                {" "}
                <IntegerInput
                    id={minEducationExpensesId}
                    value={minEducationExpenses}
                    onValueChange={setMinEducationExpenses}
                />
                {" "}
                <HelpTooltip t={t} textKey="studentMinimumEducationExpensesTooltip"/>
            </div>,
            <div key="additional-scholarships">
                <label htmlFor={maxAdditionalScholarshipsId}>{t("studentOptionalTaxableScholarshipsLabel")}</label>
                {" "}
                <IntegerInput
                    id={maxAdditionalScholarshipsId}
                    value={maxAdditionalScholarships}
                    onValueChange={setMaxAdditionalScholarships}
                />
                {" "}
                <HelpTooltip t={t} textKey="studentOptionalTaxableScholarshipsTooltip"/>
            </div>,
        ],
    );
}
