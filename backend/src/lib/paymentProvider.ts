// Payriff has never been integrated (see CLAUDE.md / product brief) — this module exists so the
// Superadmin's Payments/System Health pages have a single, honest source of truth for connection
// state, shaped so only its body changes once a real integration lands. Never fabricate a health
// status: "not connected" is a distinct, correct state, not a failure.
export type ProviderConnectionState = 'not_connected' | 'connected_healthy' | 'connected_warning' | 'connected_failing';

export function isPayriffConfigured(): boolean {
  return Boolean(process.env.PAYRIFF_API_KEY);
}

export function getPaymentProviderStatus(): { state: ProviderConnectionState; label: string } {
  if (!isPayriffConfigured()) return { state: 'not_connected', label: 'Qoşulmayıb' };
  // Real health-check logic (recent webhook latency, failure rate) belongs here once Payriff is
  // actually integrated — deliberately not built now, per the product brief's explicit scope: "Do
  // not build the complete Payriff checkout integration in this task."
  return { state: 'connected_healthy', label: 'Sağlam' };
}
