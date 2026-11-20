import {ReactNode, useId, useState} from "react";
import {getTranslator, Translator} from "./i18n.js";
import {HelpTooltip} from "./HelpTooltip.js";
import {FederalRules, FederalTaxYear, FilingStatus} from "../rules/federal.js";
import {wrapNodes} from "./wrapNodes.js";
import {SubjectToKiddieTax} from "./SubjectToKiddieTax.js";

const FILING_STATUS_ORDER: FilingStatus[] = ["single", "hoh", "mfj", "mfs", "qss"];

const FILING_STATUS_LABEL_KEYS = {
    single: "filingStatusSingle",
    hoh: "filingStatusHoh",
    mfj: "filingStatusMfj",
    mfs: "filingStatusMfs",
    qss: "filingStatusQss",
} as const;

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

    const claimantHeadingId = useId();
    const claimantFilingStatusSelectId = useId();
    const [claimantFilingStatus, setClaimantFilingStatus] = useState<FilingStatus>("mfj");
    const claimantRefundableIneligibleId = useId();
    const [claimantRefundableIneligible, setClaimantRefundableIneligible] = useState<boolean>(false);

    return wrapNodes("main", {className: "aotc-dependent-calculator"}, () => {
        let ignoreRest = false;
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

        const claimantTaxRules =
            FederalRules[taxYear as FederalTaxYear]?.[claimantFilingStatus];

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
            );

            return claimantSectionItems;
        }));

        return sections;
    });
}
