import React, { useEffect, useState } from "react";

// Opt-in controls use only the standalone mock backend, never production configuration.
export function MockControls() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/__mock", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      if (!controller.signal.aborted) setState(data);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!state) return null;
  async function changeScenario(scenario) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/__mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (!response.ok) throw new Error("Unable to change mock scenario.");
      location.reload();
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  return (
    <details className="mock-controls">
      <summary>Mock data</summary>
      <label>
        Scenario
        <select aria-label="Scenario" className="control" value={state.scenario} disabled={busy}
          onChange={(event) => changeScenario(event.target.value)}>
          {Object.entries(state.scenarios).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
