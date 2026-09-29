// Privacy-first, zero-cookie telemetry and operational audit dispatcher
export const analytics = {
 trackEvent: (eventName, properties = {}) => {
  try {
   const payload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    url: window.location.pathname,
    properties: {
     ...properties,
     userAgentSafe: navigator.userAgent.slice(0, 50)
    }
   }
   
   // Dispatch custom DOM event for audit listeners
   window.dispatchEvent(new CustomEvent('chaintrace:analytics', { detail: payload }))

   if (process.env.NODE_ENV === 'development') {
    console.debug('[Telemetry Audit]', eventName, payload)
   }
  } catch (_) {}
 },

 trackPageView: (viewName) => {
  analytics.trackEvent('page_view', { view: viewName })
  // Dynamically update document title for SEO & Investigator clarity
  const titles = {
   dashboard: 'Dashboard | ChainTrace Forensics',
   trace: 'Suspect Wallet Investigation | ChainTrace',
   batch: 'Batch Investigation Queue | ChainTrace',
   reports: 'Case Reports & Dossiers | ChainTrace',
   graph: 'Graph Flow Visualizer | ChainTrace',
   vasp: 'VASP & Exchange Directory | ChainTrace',
   intel: 'Threat Intel & Sanctions | ChainTrace',
   settings: 'Forensic System Settings | ChainTrace',
   privacy: 'Privacy & Data Governance | ChainTrace',
   terms: 'Terms & Statutory Protocol | ChainTrace',
  }
  document.title = titles[viewName] || 'ChainTrace Forensics - Blockchain Intelligence Platform'
 }
}
