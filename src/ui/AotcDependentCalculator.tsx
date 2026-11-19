import {useState} from "react";
import {getTranslator, Translator} from "./i18n.js";
import {HelpTooltip} from "./HelpTooltip.js";

export interface AotcDependentCalculatorProps {
    t?: Translator;
}

export function AotcDependentCalculator({
                                            t = getTranslator(),
                                        }: AotcDependentCalculatorProps) {
    const [stayWithinVitaScope, setStayWithinVitaScope] = useState<boolean>(false);

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
                <label>
                    <input
                        type="checkbox"
                        checked={stayWithinVitaScope}
                        onChange={(e) => setStayWithinVitaScope(e.target.checked)}
                    />
                    {t("stayWithinVitaScopeLabel")}
                </label>
                <HelpTooltip t={t} textKey="stayWithinVitaScopeTooltip"/>
            </section>
        </main>
    );
}
