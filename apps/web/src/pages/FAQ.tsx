const FAQ_ITEMS = [
  {
    q: "What is provably fair?",
    a: "Every case opening uses a commit-reveal scheme: before you open a case, our server generates a secret server seed and shows you only its hash. Your result is computed from that server seed, a client seed you control, and a nonce. Rotate your seed pair at any time to reveal the server seed used for your past opens and verify each result independently on the Verify page — the outcome could not have been chosen after the fact.",
  },
  {
    q: "How do deposits work?",
    a: "We support card payments, crypto, and CS2 skin deposits. Pick a method on the Wallet page — funds are credited to your balance once the payment provider confirms the transaction. Crypto deposits typically require a small number of network confirmations first.",
  },
  {
    q: "Why do I need to verify my identity (KYC)?",
    a: "As a licensed real-money operator we're required to verify player identity before withdrawals, in line with anti-money-laundering regulations. Submit your documents from the Profile page — most verifications complete within minutes.",
  },
  {
    q: "How do withdrawals work?",
    a: "Once your account is KYC-verified, request a withdrawal from the Wallet page via card, crypto, or CS2 skins. Withdrawals are reviewed for compliance and typically processed within 24 hours.",
  },
  {
    q: "Can I log in with Steam?",
    a: "Yes — click \"Log in via Steam\" and approve the request on Steam. We only read your public SteamID and profile info to create your account; we never see or store your Steam password.",
  },
];

export function FAQPage() {
  return (
    <div>
      <h1>FAQ</h1>
      <div className="faq-list">
        {FAQ_ITEMS.map((item) => (
          <details key={item.q} className="faq-item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
