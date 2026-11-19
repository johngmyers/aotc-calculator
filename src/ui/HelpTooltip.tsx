import {useId, useState} from "react";
import {MessageKey, Translator} from "./i18n.js";

export interface HelpTooltipProps {
    t: Translator;
    textKey: MessageKey;
    vars?: Record<string, string | number | undefined>;
}

export function HelpTooltip({
                                t,
                                textKey,
                                vars,
                            }: HelpTooltipProps) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const text = t(textKey, vars);
    const triggerLabel = t.try(textKey + "Label", vars) ?? t("helpTooltipDefaultTriggerLabel");

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