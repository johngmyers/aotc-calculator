import {type InputHTMLAttributes} from "react";
import {type NumberFormatValues, NumericFormat} from "react-number-format";

export interface IntegerInputProps
    extends Omit<
        InputHTMLAttributes<HTMLInputElement>,
        "value" | "defaultValue" | "onChange" | "type"
    > {
    value: number | undefined;
    onValueChange: (value: number | undefined) => void;
    allowNegative?: boolean;
}

export function IntegerInput({
                                 value,
                                 onValueChange,
                                 allowNegative = false,
                                 ...rest
                             }: IntegerInputProps) {
    const handleValueChange = (values: NumberFormatValues) => {
        onValueChange(values.floatValue);
    };

    return (
        <NumericFormat
            {...rest}
            type="text"
            inputMode="numeric"
            thousandSeparator=","
            decimalScale={0}
            allowNegative={allowNegative}
            value={value ?? ""}
            onValueChange={handleValueChange}
        />
    );
}
