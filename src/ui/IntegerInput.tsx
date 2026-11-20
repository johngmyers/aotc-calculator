import {useId, useState} from "react";
import {type NumberFormatValues, NumericFormat} from "react-number-format";
import {getTranslator, type MessageKey, type TranslationVars, type Translator,} from "./i18n.js";

export type IntegerValidator = (
    value: number | undefined,
) => MessageKey | undefined;

export const valueRequired: IntegerValidator = (value) =>
    value === undefined ? ("valueIsRequired" as MessageKey) : undefined;

export interface IntegerInputProps {
    id?: string;
    name?: string;
    value?: number;
    onValueChange?: (value: number | undefined) => void;
    t?: Translator;
    validator?: IntegerValidator;
    vars?: TranslationVars;
    hidden?: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
}

export function IntegerInput({
                                 id,
                                 name,
                                 value,
                                 onValueChange,
                                 t = getTranslator(),
                                 validator,
                                 vars,
                                 hidden,
                                 disabled,
                                 placeholder,
                                 className,
                                 "aria-label": ariaLabel,
                                 "aria-labelledby": ariaLabelledBy,
                             }: IntegerInputProps) {
    const errorId = useId();
    const [touched, setTouched] = useState(false);

    const errorKey = validator?.(value);
    const showError = touched && errorKey !== undefined;
    const errorMessage = showError ? t(errorKey, vars) : undefined;

    const handleValueChange = (values: NumberFormatValues) => {
        onValueChange?.(values.floatValue);
    };

    const combinedClassName = [
        "integer-input",
        showError ? "integer-input--error" : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <span hidden={hidden} className="integer-input-wrapper">
            <NumericFormat
                id={id}
                name={name}
                value={value ?? ""}
                onValueChange={handleValueChange}
                onBlur={() => setTouched(true)}
                thousandSeparator=","
                decimalScale={0}
                allowNegative={false}
                disabled={disabled}
                placeholder={placeholder}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-invalid={showError ? true : undefined}
                aria-describedby={showError ? errorId : undefined}
                className={combinedClassName}
            />
            {showError && (
                <span id={errorId} role="alert" className="integer-input__error">
                    {errorMessage}
                </span>
            )}
        </span>
    );
}
