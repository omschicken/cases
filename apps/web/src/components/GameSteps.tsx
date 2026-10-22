type Step = { title: string; description: string };

export function GameSteps({ label, steps }: { label: string; steps: [Step, Step, Step] }) {
  return <section className="game-steps" aria-label={label}>
    <div className="game-steps-heading"><span>{label}</span><span>01 — 03</span></div>
    <ol>{steps.map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></li>)}</ol>
  </section>;
}
