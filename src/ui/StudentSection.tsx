import {ReactNode, useEffect, useId, useState} from "react";
import {Translator} from "./i18n.js";
import {wrapNodes} from "./wrapNodes.js";
import {FilingStatus} from "../rules/federal.js";
import {FILING_STATUS_LABEL_KEYS, FILING_STATUS_ORDER} from "./AotcDependentCalculator.js";
import {IntegerInput} from "./IntegerInput.js";
import {HelpTooltip} from "./HelpTooltip.js";

export interface StudentSectionProps {
    studentNumber: number
    hidden: boolean
    onNameChange: (name: string) => void
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

export function StudentSection({
                                   studentNumber,
                                   hidden,
                                   onNameChange,
                                   t,
                               }: StudentSectionProps) {
    const headingId = useId();
    const nameInputId = useId();
    const [rawName, setRawName] = useState("");
    const filingStatusSelectId = useId();
    const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
    const minTaxableScholarshipsId = useId();
    const [minTaxableScholarships, setMinTaxableScholarships] = useState<number | undefined>(undefined);
    const minEducationExpensesId = useId();
    const [minEducationExpenses, setMinEducationExpenses] = useState<number | undefined>(undefined);
    const maxAdditionalScholarshipsId = useId();
    const [maxAdditionalScholarships, setMaxAdditionalScholarships] = useState<number | undefined>(undefined);

    useEffect(() => {
        onNameChange(getEffectiveStudentName(rawName, studentNumber, t));
    }, [onNameChange, rawName, studentNumber, t]);

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
