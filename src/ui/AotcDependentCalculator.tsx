import {ReactNode, useCallback, useId, useMemo, useRef, useState} from "react";
import {getTranslator, Translator} from "./i18n.js";
import {HelpTooltip} from "./HelpTooltip.js";
import {FederalRules, FederalTaxYear, FilingStatus} from "../rules/federal.js";
import {wrapNodes} from "./wrapNodes.js";
import {SubjectToKiddieTax} from "./SubjectToKiddieTax.js";
import {getFederalLineRevision} from "../rules/federalLines.js";
import {IntegerInput, valueRequired} from "./IntegerInput.js";
import {AotcInput, calculateAotc} from "../calc/calculateAotc.js";
import {StudentSection} from "./StudentSection.js";
import {StudentExpenseCost} from "../calc/optimizeAotc.js";
import {AotcResult} from "./AotcResult.js";

export const FILING_STATUS_ORDER: FilingStatus[] = ["single", "hoh", "mfj", "mfs", "qss"];

export const FILING_STATUS_LABEL_KEYS = {
    single: "filingStatusSingle",
    hoh: "filingStatusHoh",
    mfj: "filingStatusMfj",
    mfs: "filingStatusMfs",
    qss: "filingStatusQss",
} as const;

const MAX_STUDENTS = 1;

export interface AotcDependentCalculatorProps {
    t?: Translator
    now?: Date
}

export function AotcDependentCalculator({
                                            t = getTranslator(),
                                            now = new Date(),
                                        }: AotcDependentCalculatorProps) {
    const [stayWithinVitaScope, setStayWithinVitaScope] = useState<boolean>(false);

    const federalTaxYears = Object.keys(FederalRules)
        .map((k) => Number(k))
        .filter((y) => Number.isInteger(y))
        .sort((a, b) => a - b); // oldest first
    const defaultTaxYear = (() => {
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed: September = 8, October = 9
        const day = now.getDate();

        const onOrBeforeOct15 = month < 9 || (month === 9 && day <= 15);
        const candidate = onOrBeforeOct15 ? year - 1 : year;

        if (federalTaxYears.includes(candidate)) {
            return candidate;
        }
        return federalTaxYears[federalTaxYears.length - 1];
    })();
    const taxYearSelectId = useId();
    const [taxYear, setTaxYear] = useState<number>(defaultTaxYear);
    const federalLineRevision = getFederalLineRevision(taxYear as FederalTaxYear)

    const claimantHeadingId = useId();
    const claimantFilingStatusSelectId = useId();
    const [claimantFilingStatus, setClaimantFilingStatus] = useState<FilingStatus>("mfj");
    const [claimantRefundableIneligible, setClaimantRefundableIneligible] = useState<boolean>(false);
    const claimantAgiId = useId();
    const [claimantAgi, setClaimantAgi] = useState<number | undefined>(undefined);
    const claimantTaxBeforeNonrefundableCreditsId = useId();
    const [claimantTaxBeforeNonrefundableCredits, setClaimantTaxBeforeNonrefundableCredits] = useState<number | undefined>(undefined);
    const claimantNonrefundableCreditsId = useId();
    const [claimantNonrefundableCredits, setClaimantNonrefundableCredits] = useState<number | undefined>(undefined);
    const [optimalAotcInputs, setOptimalAotcInputs] = useState<AotcInput>({
        agi: 0,
        students: [],
    })

    const resultsNoClaimantBenefitHeadingId = useId();

    const [studentNames, setStudentNames] = useState<string[]>(() =>
        Array.from({length: MAX_STUDENTS}, () => ""),
    );
    type NameChangeHandler = (nextName: string) => void;
    const nameChangeHandlersRef = useRef<Map<number, NameChangeHandler>>(new Map());
    const getStudentNameChangeHandler = useCallback((index: number) => {
        let handler = nameChangeHandlersRef.current.get(index);
        if (!handler) {
            handler = (nextName: string) => {
                setStudentNames((prev) => {
                    if (prev[index] === nextName) {
                        return prev;
                    }
                    const next = [...prev];
                    next[index] = nextName;
                    return next;
                });
            };
            nameChangeHandlersRef.current.set(index, handler);
        }
        return handler;
    }, []);
    const [studentExpenseCosts, setStudentExpenseCosts] = useState<StudentExpenseCost[][]>(() =>
        Array.from({length: MAX_STUDENTS}, () => [{
            qualifiedExpenses: 0,
            cost: 0,
            outOfScopeForVITA: false,
        }]),
    );
    const setStudentExpenseCostsAt = useCallback(
        (index: number) => (nextExpenseCosts: StudentExpenseCost[]) => {
            setStudentExpenseCosts((prev) => {
                const next = [...prev];
                next[index] = nextExpenseCosts;
                return next;
            });
        },
        [],
    );

    return wrapNodes("main", {className: "aotc-dependent-calculator"}, () => {
        let ignoreRest = false;
        let suppressResults = false;
        const sections: ReactNode[] = [
            <header key="header">
                <h1>
                    <center>{t("title")}</center>
                </h1>
                <center>{t("subtitle")}</center>
            </header>,

            <div
                key="scope-exclusions"
                className="scope-exclusions"
                dangerouslySetInnerHTML={{__html: t("scopeExclusionsBlurb")}}
            />,

            <section key="calculator-settings" aria-label={t("calculatorSettingsSectionLabel")}>
                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={stayWithinVitaScope}
                            onChange={(e) => setStayWithinVitaScope(e.target.checked)}
                        />
                        {t("stayWithinVitaScopeLabel")}
                    </label>
                    {" "}
                    <HelpTooltip t={t} textKey="stayWithinVitaScopeTooltip"/>
                </div>

                <div>
                    <label htmlFor={taxYearSelectId}>{t("taxYearLabel")}</label>
                    {" "}
                    <select
                        id={taxYearSelectId}
                        value={taxYear}
                        onChange={(e) => setTaxYear(Number(e.target.value))}
                    >
                        {federalTaxYears.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
            </section>,

            <hr key="hr-claimant"/>,
        ];

        const claimantTaxRules = useMemo(
            () => FederalRules[taxYear as FederalTaxYear]?.[claimantFilingStatus],
            [taxYear, claimantFilingStatus],
        );

        sections.push(wrapNodes("section", {key: "claimant", "aria-labelledby": claimantHeadingId}, () => {
            const claimantSectionItems: ReactNode[] = [
                <h2 key="claimant-header" id={claimantHeadingId}>
                    <center>{t("claimantSectionTitle")}</center>
                </h2>,

                <div key="claimant-filing-status">
                    <label htmlFor={claimantFilingStatusSelectId}>{t("filingStatusLabel")}</label>{" "}
                    <select
                        id={claimantFilingStatusSelectId}
                        value={claimantFilingStatus}
                        onChange={(e) => setClaimantFilingStatus(e.target.value as FilingStatus)}
                    >
                        {FILING_STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>
                                {t(FILING_STATUS_LABEL_KEYS[status])}
                            </option>
                        ))}
                    </select>
                </div>,
            ];

            if (!claimantTaxRules?.aotc) {
                claimantSectionItems.push(
                    <div key="aotc-disallowed" role="status" className="aotc-disallowed-notice">
                        <span aria-hidden="true">⚠</span> {t("aotcDisallowedByFilingStatus")}
                    </div>,
                );
                ignoreRest = true;
            }

            claimantSectionItems.push(
                <SubjectToKiddieTax
                    key="claimant-refundable-ineligible"
                    t={t}
                    filingStatus={claimantFilingStatus}
                    defaultAgeBracket="24OrOlder"
                    requireFullTimeStudent
                    hidden={ignoreRest}
                    onChange={setClaimantRefundableIneligible}
                />,
                <div key="claimant-agi" hidden={ignoreRest}>
                    <label htmlFor={claimantAgiId}>{t("agiLabel")}</label>
                    <span className="required-indicator" aria-hidden="true">*</span>
                    {" "}
                    <IntegerInput
                        id={claimantAgiId}
                        value={claimantAgi}
                        onValueChange={setClaimantAgi}
                        validator={valueRequired}
                    />
                    {" "}
                    <HelpTooltip
                        t={t}
                        lineRef={federalLineRevision.agi}
                    />
                </div>,
                <div key="claimant-tax" hidden={ignoreRest}>
                    <label
                        htmlFor={claimantTaxBeforeNonrefundableCreditsId}>{t("taxBeforeNonrefundableCreditsLabel")}</label>
                    <span className="required-indicator" aria-hidden="true">*</span>
                    {" "}
                    <IntegerInput
                        id={claimantTaxBeforeNonrefundableCreditsId}
                        value={claimantTaxBeforeNonrefundableCredits}
                        onValueChange={setClaimantTaxBeforeNonrefundableCredits}
                        validator={valueRequired}
                    />
                    {" "}
                    <HelpTooltip
                        t={t}
                        lineRef={federalLineRevision.taxBeforeNonrefundableCredits}
                    />
                </div>,
                <div key="claimant-credits" hidden={ignoreRest}>
                    <label htmlFor={claimantNonrefundableCreditsId}>{t("nonrefundableCreditsLabel")}</label>
                    {" "}
                    <IntegerInput
                        id={claimantNonrefundableCreditsId}
                        value={claimantNonrefundableCredits}
                        onValueChange={setClaimantNonrefundableCredits}
                    />
                    {" "}
                    <HelpTooltip
                        t={t}
                        lineRef={federalLineRevision.nonrefundableCredits}
                    />
                </div>,
            );

            return claimantSectionItems;
        }));

        // Check if AOTC benefits claimant at all
        if (!ignoreRest) {
            const creditsBeforeAotc = claimantNonrefundableCredits ?? 0;
            const effectiveTbnc =
                claimantTaxBeforeNonrefundableCredits ?? creditsBeforeAotc + 1000;

            const aotcResult = calculateAotc(claimantTaxRules, {
                agi: claimantAgi ?? 0,
                refundableIneligible: claimantRefundableIneligible,
                students: [{qualifiedExpenses: 100_000}],
            });

            if (
                aotcResult.refundableCredit === 0 &&
                (aotcResult.nonrefundableCredit === 0 ||
                    creditsBeforeAotc >= effectiveTbnc)
            ) {
                ignoreRest = true;
                sections.push(
                    <hr key="hr-results-no-claimant-benefit"/>,
                    <section
                        key="results-no-claimant-benefit"
                        aria-labelledby={resultsNoClaimantBenefitHeadingId}
                    >
                        <h2
                            key="results-no-claimant-benefit-header"
                            id={resultsNoClaimantBenefitHeadingId}
                        >
                            <center>{t("resultsSectionTitle")}</center>
                        </h2>
                        <div key="results-no-claimant-benefit-summary" role="status">
                            {t("noAotcBenefitSummary")}
                        </div>
                    </section>,
                );
            }
        }
        if (claimantAgi === undefined || claimantTaxBeforeNonrefundableCredits === undefined) {
            suppressResults = true
        }

        studentNames.forEach((student, index) => {
            const studentNumber = index + 1;

            sections.push(
                <hr key={`hr-student-${studentNumber}`}
                    hidden={ignoreRest}/>,
                <StudentSection
                    key={`student-${studentNumber}`}
                    studentNumber={studentNumber}
                    hidden={ignoreRest}
                    taxYear={taxYear as FederalTaxYear}
                    expensesCap={claimantTaxRules.aotc?.secondTierCap ?? 1}
                    onNameChange={getStudentNameChangeHandler(index)}
                    onExpenseCostsChange={setStudentExpenseCostsAt(index)}
                    t={t}
                />,
            );
        });

        if (!ignoreRest && !suppressResults) {
            sections.push(
                <hr key={"results"}/>,
                <AotcResult
                    stayWithinVitaScope={stayWithinVitaScope}
                    claimantTaxRules={claimantTaxRules}
                    claimantRefundableIneligible={claimantRefundableIneligible}
                    claimantAgi={claimantAgi!}
                    claimantTaxBeforeNonrefundableCredits={claimantTaxBeforeNonrefundableCredits!}
                    claimantNonrefundableCredits={claimantNonrefundableCredits ?? 0}
                    studentNames={studentNames}
                    studentExpenseCosts={studentExpenseCosts}
                    setOptimalAotcInputs={setOptimalAotcInputs}
                    t={t}
                />,
            )
        }

        return sections;
    });
}
