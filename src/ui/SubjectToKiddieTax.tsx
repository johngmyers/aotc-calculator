import {useEffect, useId, useState} from "react";
import {type FilingStatus} from "../rules/federal.js";
import {type Translator} from "./i18n.js";

export type AgeBracket = "24OrOlder" | "under18" | "age18" | "19to23";

export interface SubjectToKiddieTaxProps {
    t: Translator;
    filingStatus: FilingStatus;
    defaultAgeBracket?: AgeBracket;
    requireFullTimeStudent?: boolean;
    hidden?: boolean;
    onChange: (isSubject: boolean) => void;
}

const AGE_BRACKET_OPTIONS: { value: AgeBracket; labelKey: string }[] = [
    {value: "under18", labelKey: "ageBracketUnder18"},
    {value: "age18", labelKey: "ageBracket18"},
    {value: "19to23", labelKey: "ageBracket19to23"},
    {value: "24OrOlder", labelKey: "ageBracket24OrOlder"},
];

export function SubjectToKiddieTax({
                                       t,
                                       filingStatus,
                                       defaultAgeBracket = "19to23",
                                       requireFullTimeStudent = false,
                                       hidden = false,
                                       onChange,
                                   }: SubjectToKiddieTaxProps) {
    const radioGroupName = useId();
    const studentCheckboxId = useId();
    const livingParentId = useId();
    const earnedSupportId = useId();

    const [ageBracket, setAgeBracket] = useState<AgeBracket>(defaultAgeBracket);
    const [meetsStudentEnrollment, setMeetsStudentEnrollment] =
        useState<boolean>(true);
    const [hasLivingParent, setHasLivingParent] = useState<boolean>(true);
    const [earnedMoreThanHalfSupport, setEarnedMoreThanHalfSupport] =
        useState<boolean>(false);

    const isFilingStatusHidden = filingStatus === "mfj";
    const needsLivingParentCheck = ageBracket !== "24OrOlder";
    const is19to23 = ageBracket === "19to23";
    const showsStudentCheck = is19to23 && hasLivingParent;
    const isPotentiallySubject =
        ageBracket === "under18" ||
        ageBracket === "age18" ||
        (is19to23 && meetsStudentEnrollment);
    const showsEarnedSupportCheck =
        hasLivingParent &&
        (ageBracket === "age18" || (is19to23 && meetsStudentEnrollment));

    const isSubject =
        !isFilingStatusHidden &&
        hasLivingParent &&
        isPotentiallySubject &&
        (ageBracket === "under18" || !earnedMoreThanHalfSupport);

    useEffect(() => {
        onChange(isSubject);
    }, [isSubject, onChange]);

    const studentLabelKey = requireFullTimeStudent
        ? "fullTimeStudentLabel"
        : "halfTimeStudentLabel";

    return (
        <div
            className="subject-to-kiddie-tax"
            hidden={hidden || isFilingStatusHidden}
        >
            <fieldset>
                <legend>{t("ageLabel")}</legend>
                {AGE_BRACKET_OPTIONS.map(({value, labelKey}) => (
                    <div key={value}>
                        <label>
                            <input
                                type="radio"
                                name={radioGroupName}
                                value={value}
                                checked={ageBracket === value}
                                onChange={() => setAgeBracket(value)}
                            />{" "}
                            {t(labelKey)}
                        </label>
                    </div>
                ))}
            </fieldset>

            <div hidden={!needsLivingParentCheck}>
                <label htmlFor={livingParentId}>
                    <input
                        id={livingParentId}
                        type="checkbox"
                        checked={hasLivingParent}
                        onChange={(e) => setHasLivingParent(e.target.checked)}
                    />{" "}
                    {t("hasLivingParentLabel")}
                </label>
            </div>

            <div hidden={!showsStudentCheck}>
                <label htmlFor={studentCheckboxId}>
                    <input
                        id={studentCheckboxId}
                        type="checkbox"
                        checked={meetsStudentEnrollment}
                        onChange={(e) => setMeetsStudentEnrollment(e.target.checked)}
                    />{" "}
                    {t(studentLabelKey)}
                </label>
            </div>

            <div hidden={!showsEarnedSupportCheck}>
                <label htmlFor={earnedSupportId}>
                    <input
                        id={earnedSupportId}
                        type="checkbox"
                        checked={earnedMoreThanHalfSupport}
                        onChange={(e) =>
                            setEarnedMoreThanHalfSupport(e.target.checked)
                        }
                    />{" "}
                    {t("earnedMoreThanHalfSupportLabel")}
                </label>
            </div>
        </div>
    );
}
