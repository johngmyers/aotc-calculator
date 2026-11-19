import {useId, useState} from "react";
import {getTranslator, Translator} from "./i18n.js";
import {HelpTooltip} from "./HelpTooltip.js";
import {FederalRules} from "../rules/federal.js";

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

    return (
        <main className="aotc-dependent-calculator">
            <header>
                <h1>
                    <center>{t("title")}</center>
                </h1>
                <center>{t("subtitle")}</center>
            </header>

            <div
                className="scope-exclusions"
                dangerouslySetInnerHTML={{__html: t("scopeExclusionsBlurb")}}
            />

            <section aria-label={t("calculatorSettingsSectionLabel")}>
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
            </section>
        </main>
    );
}
