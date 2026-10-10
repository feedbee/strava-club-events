// Only opt-in mock pages show development controls; production endpoints are unchanged.
if (new URLSearchParams(location.search).get("mock") === "1") {
  const response = await fetch("/__mock");
  if (response.ok) {
    const state = await response.json();
    const panel = document.createElement("details");
    panel.className = "mock-controls";
    const summary = document.createElement("summary");
    summary.textContent = "Mock data";
    const label = document.createElement("label");
    label.textContent = "Scenario ";
    const select = document.createElement("select");
    for (const [value, title] of Object.entries(state.scenarios)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = title;
      select.append(option);
    }
    select.value = state.scenario;
    select.addEventListener("change", async () => {
      select.disabled = true;
      const response = await fetch("/__mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: select.value }),
      });
      if (response.ok) location.reload();
      else select.disabled = false;
    });
    label.append(select);
    panel.append(summary, label);
    document.querySelector(".experiment-header").after(panel);
  }
}
