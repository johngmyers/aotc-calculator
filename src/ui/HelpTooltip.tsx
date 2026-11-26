import {useId, useState} from "react";
import {type FormLineRef} from "../rules/federalLines.js";
import {type MessageKey, type Translator} from "./i18n.js";

export type HelpTooltipProps =
    | {
    t: Translator;
    textKey: MessageKey;
    vars?: Record<string, string | number | undefined>;
    lineRefs?: never;
}
    | {
    t: Translator;
    lineRefs: readonly FormLineRef[];
    textKey?: never;
    vars?: never;
};

function resolveTooltipText(t: Translator, props: HelpTooltipProps): string {
    if (props.lineRefs !== undefined) {
        const separator = t("federalLineListSeparator");
        return props.lineRefs.map((lineRef) => {
            const kindKey =
                lineRef.kind === "form"
                    ? "federalLineKindForm"
                    : "federalLineKindSchedule";
            return t("federalLineReference", {
                refKind: t(kindKey),
                refForm: lineRef.form,
                refLine: lineRef.line,
            });
        }).join(separator);
    }
    return t(props.textKey, props.vars);
}

export function HelpTooltip(props: HelpTooltipProps) {
    const {t} = props;
    const id = useId();
    const [open, setOpen] = useState(false);
    const text = resolveTooltipText(t, props);
    const triggerLabel =
        (props.textKey !== undefined ? t.try(`${props.textKey}Label`, props.vars) : undefined) ??
        t("helpTooltipDefaultTriggerLabel");

    return (
        <span
            className="help-tooltip"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
            }}
        >
            <button
                type="button"
                className="help-tooltip__trigger"
                aria-label={triggerLabel}
                aria-describedby={open ? id : undefined}
            >
                ?
            </button>
            {open && (
                <span id={id} role="tooltip" className="help-tooltip__bubble">
                    {text}
                </span>
            )}
        </span>
    );
}