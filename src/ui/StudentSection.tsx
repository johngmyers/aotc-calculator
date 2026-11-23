import {useEffect, useId, useState} from "react";
import {Translator} from "./i18n.js";

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

    useEffect(() => {
        onNameChange(getEffectiveStudentName(rawName, studentNumber, t));
    }, [onNameChange, rawName, studentNumber, t]);

    return (
        <section aria-labelledby={headingId} hidden={hidden}>
            <h2 id={headingId}>
                <center>{t("studentSectionTitle", {number: studentNumber})}</center>
            </h2>
            <div>
                <label htmlFor={nameInputId}>{t("studentNameLabel")}</label>{" "}
                <input
                    id={nameInputId}
                    type="text"
                    value={rawName}
                    hidden={hidden}
                    onChange={(e) => setRawName(e.target.value)}/>
            </div>
        </section>
    );
}
