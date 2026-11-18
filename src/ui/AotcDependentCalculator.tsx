import { useState } from "react";

export function AotcDependentCalculator() {
  const [stayWithinVitaScope, setStayWithinVitaScope] = useState<boolean>(false);

  return (
    <main className="aotc-dependent-calculator">
      <header>
        <h1>American Opportunity Tax Credit (AOTC) Optimizing Calculator</h1>
        <h2>For claimants with dependent students</h2>
      </header>

      <section aria-label="Scope">
        <label>
          <input
            type="checkbox"
            checked={stayWithinVitaScope}
            onChange={(e) => setStayWithinVitaScope(e.target.checked)}
          />
          Stay within scope for VITA/TCE
        </label>
      </section>
    </main>
  );
}
