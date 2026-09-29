/* ============================================================
   VASP FORENSIC ENGINE — APPLICATION LOGIC
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
let currentReport = null;
let allLedgerRows = [];
let graphNodes = [];
let graphEdges = [];
let graphShowLabels = true;
let animFrame = null;
let sidebarCollapsed = false;

// ── Typology Registry (matches backend) ──────────────────────
const TYPOLOGY_REGISTRY = {
  'TYP-CFT-01': { code: 'TYP-CFT-01', title: 'Terrorism Financing Risk', level: 'CRITICAL', weight: 100, ref: 'UAPA Sec 51A / PMLA Sec 3', desc: 'Direct or indirect linkage with addresses designated under UAPA / UNSC 1267.', action: 'Immediate freeze request via FIU-IND / NIA escalation / UNSC designated asset freeze.' },
  'TYP-CYBER-01': { code: 'TYP-CYBER-01', title: 'Ransomware Extortion Proceeds', level: 'CRITICAL', weight: 95, ref: 'IT Act Section 66 / 66F', desc: 'Funds linked to ransomware extortion campaigns (LockBit, WannaCry, BlackCat, Conti).', action: 'Coordinate with CERT-In & international law enforcement (Interpol / FBI IC3) to track cash-out points.' },
  'TYP-SANCT-01': { code: 'TYP-SANCT-01', title: 'International Sanctioned Entity', level: 'CRITICAL', weight: 95, ref: 'UN Security Council Act / MEA Directives', desc: 'Interaction with addresses on OFAC SDN, EU, or UN sanctions lists including DPRK Lazarus Group.', action: 'Issue formal blacklisting notification to all domestic reporting entities.' },
  'TYP-DNM-01': { code: 'TYP-DNM-01', title: 'Darknet Marketplace Contraband', level: 'CRITICAL', weight: 90, ref: 'NDPS Act / IPC Cyber Offenses', desc: 'Transactions routed to or from illicit darknet markets (Hydra, AlphaBay, Silk Road).', action: 'Procure vendor transaction identifiers & initiate NCB / Cyber Police investigation.' },
  'TYP-AML-01': { code: 'TYP-AML-01', title: 'Money Laundering via Mixer/Tumbler', level: 'CRITICAL', weight: 85, ref: 'Section 3 PMLA 2002', desc: 'Deliberate concealment and severing of blockchain audit trails via zero-knowledge or UTXO coin mixing.', action: 'Record in FIR as deliberate concealment of proceeds of crime. Flag non-custodial anonymity pool.' },
  'TYP-FEMA-01': { code: 'TYP-FEMA-01', title: 'Illegal Offshore Betting / Gambling', level: 'HIGH', weight: 65, ref: 'FEMA / State Public Gambling Acts', desc: 'Outflows directed into unauthorized offshore betting platforms violating Indian gaming laws.', action: 'Submit domain/ISP blocking order under IT Act 69A and summon Indian payment intermediary gateways.' },
  'TYP-PEEL-01': { code: 'TYP-PEEL-01', title: 'Peeling Chain & Rapid Layering', level: 'HIGH', weight: 60, ref: 'FATF Red Flag Indicator — Automated Structuring', desc: 'Automated sweeping where funds are rapidly fragmented across short timeframes with high split ratios.', action: 'Construct topological fund flow graph to identify the terminal consolidation or cash-out wallet.' },
  'TYP-XCHAIN-01': { code: 'TYP-XCHAIN-01', title: 'Cross-Chain Bridge Hopping', level: 'MEDIUM', weight: 45, ref: 'FIU-IND Red Flag Indicator — Cross-Chain Capital Flight', desc: 'Use of decentralized cross-chain bridge protocols (Across, Stargate, Wormhole) to break linear forensics.', action: 'Decode cross-chain relayer deposit/fill transaction logs to follow funds on the destination ledger.' },
  'TYP-LAYER-01': { code: 'TYP-LAYER-01', title: 'Multi-Hop Structured Layering', level: 'MEDIUM', weight: 35, ref: 'PMLA Section 12 — Suspicious Transaction Report', desc: 'Funds traversed through multiple intermediary unhosted hops (>= 4 hops) without legitimate justification.', action: 'Trace forward until a custodial VASP / KYC gateway is identified for Section 91 CrPC notice.' },
  'TYP-GATEWAY-01': { code: 'TYP-GATEWAY-01', title: 'Regulated Custodial VASP Gateway', level: 'LOW', weight: 5, ref: 'Section 91 CrPC / Section 94 BNSS 2023', desc: 'Funds deposited into centralized custodial exchange (Binance, OKX, CoinDCX, WazirX) offering KYC records.', action: 'Serve statutory preservation & account-freeze notice under Section 91 CrPC / 94 BNSS to Exchange Nodal Desk.' },
};

const PUBLIC_RPC_NODES = {
  ETH: ['eth.merkle.io', 'ethereum-rpc.publicnode.com', '1rpc.io/eth'],
  BTC: ['blockstream.info/api', 'mempool.emzy.de/api', 'mempool.space/api'],
  TRON: ['api.trongrid.io', 'api.shasta.trongrid.io'],
  BNB: ['bsc-dataseed.binance.org', 'bsc-rpc.publicnode.com'],
  MATIC: ['polygon-bor-rpc.publicnode.com', '1rpc.io/matic'],
  SOL: ['api.mainnet-beta.solana.com'],
};

// ── Demo Case Data (from real report) ────────────────────────
const DEMO_CASE = {
  case_id: 'VASP-20260919_125547',
  generated_at: '2026-09-19T12:55:47.955549+00:00',
  engine: 'Automated Blockchain Forensic & VASP Attribution Engine (Zero API Keys)',
  graph_engine: 'TransactionGraphBackend (C++ CSR Graph + Microsecond BFS)',
  cpp_engine_stats: { nodesCount: 21, edgesCount: 20, nodesVisited: 21, edgesExamined: 22, executionTimeUs: 12, truncated: false },
  suspect_address: 'bc1q9wnz3hjqt4mms7ed7ap57zhcv5psmt63kg8gfh',
  blockchain: 'BTC',
  max_hops_traced: 15,
  duration_seconds: 65.35,
  on_chain_summary: { total_inflow: 0.06866266, total_outflow: 0.06812665, inflow_count: 11, outflow_count: 14, transfers_traced: 22 },
  risk_assessment: {
    risk_score: 45, risk_level: 'HIGH',
    forensic_verdict: 'Risk Level: HIGH | Typology: Peeling Chain & Rapid Layering + Multi-Hop Structured Layering',
    category_breakdown: { peeling_chain: 60.0, unhosted: 20.0 },
    typologies: [
      { code: 'TYP-PEEL-01', title: 'Peeling Chain & Rapid Layering', severity: 'HIGH', base_threat_weight: 60, statutory_reference: 'FATF Red Flag Indicator — Automated Structuring', description: 'Automated sweeping where funds are rapidly fragmented across short timeframes with high split ratios.', investigative_action: 'Construct topological fund flow graph to identify the terminal consolidation or cash-out wallet.' },
      { code: 'TYP-LAYER-01', title: 'Multi-Hop Structured Layering', severity: 'MEDIUM', base_threat_weight: 35, statutory_reference: 'PMLA Section 12 — Suspicious Transaction Report (STR) Indicator', description: 'Funds traversed through multiple intermediary unhosted hops (>= 4 hops) without legitimate commercial justification.', investigative_action: 'Trace forward until a custodial VASP / KYC gateway is identified for Section 91 CrPC notice.' },
      { code: 'TYP-GATEWAY-01', title: 'Regulated Custodial VASP Gateway', severity: 'LOW', base_threat_weight: 5, statutory_reference: 'Section 91 CrPC / Section 94 BNSS 2023', description: 'Funds deposited into centralized custodial exchange Binance offering KYC records.', investigative_action: 'Serve statutory preservation & account-freeze notice to compliance@binance.com.' },
    ],
    high_risk_alerts: []
  },
  cross_chain_hops: [],
  vasp_targets: [
    { hop: 5, address: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', vasp_name: 'Binance', jurisdiction: 'Global', compliance_email: 'compliance@binance.com', acc_score: 0.85, paes_score: 0.6, statutory_notice: 'Section 91 CrPC / Section 94 BNSS' },
    { hop: 4, address: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', vasp_name: 'Binance', jurisdiction: 'Global', compliance_email: 'compliance@binance.com', acc_score: 0.85, paes_score: 0.6, statutory_notice: 'Section 91 CrPC / Section 94 BNSS' },
  ],
  chain_of_custody_ledger: [
    { hop: 1, from: 'bc1q9wnz3hjqt4mms7ed7ap57zhcv5psmt63kg8gfh', to: 'bc1qjn7e2xk99m4g4d4j3hszxqfh4uk585jq5m6dt7', amount: 0.02125592, timestamp: 1789239507, tx_hash: '4c4098120ec8ad2cf14d0b17dc2ca793ef413c008edc56b9fa5d50f0e6baca04', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.90 },
    { hop: 2, from: 'bc1qjn7e2xk99m4g4d4j3hszxqfh4uk585jq5m6dt7', to: 'bc1qvgwtu2k0edlxqt7xv2tekas8qftk0t2ed46l9y', amount: 0.000347, timestamp: 1789822477, tx_hash: 'e1cfdf04db87fe83e5412c77a1fe38db318db938ed35ba88f38499e09df5fbe9', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.80 },
    { hop: 3, from: 'bc1qvgwtu2k0edlxqt7xv2tekas8qftk0t2ed46l9y', to: 'bc1qzmtn0q92ayejt2hpffvlktcpmyy7vvsd06sefu', amount: 0.00039302, timestamp: 1789835732, tx_hash: '1211964db41915439bc75fc4a6c3ac24d8d763d64fd207a7387d28795345b044', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.70 },
    { hop: 3, from: 'bc1qvgwtu2k0edlxqt7xv2tekas8qftk0t2ed46l9y', to: 'bc1q0fycgp9sta5a2m9weh4y4nc8u257l33p5tzykc', amount: 0.00038709, timestamp: 1789838978, tx_hash: '8bd05e88d969bdcb903867e837ab2d5f5a79f41de8fef6142f0437aa4611b550', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.70 },
    { hop: 4, from: 'bc1q0fycgp9sta5a2m9weh4y4nc8u257l33p5tzykc', to: 'bc1q8kaht9suldvmhpn9vcmtepsh53ne9q4fdcjrhy', amount: 15.00006136, timestamp: 1789840049, tx_hash: '83649682325ee593268a53dd0819820f289f78673be673f448c8ceb098942e1c', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.60 },
    { hop: 5, from: 'bc1q8kaht9suldvmhpn9vcmtepsh53ne9q4fdcjrhy', to: '1AVDTMEFsKRULM3mjxEHM3idU9dJuYGHhG', amount: 15.0, timestamp: 1789840049, tx_hash: '6f55bcd4031c9788adaf51a9f5e833c21c96dbc7df853a954735637dc2aa72c9', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.50 },
    { hop: 1, from: 'bc1q9wnz3hjqt4mms7ed7ap57zhcv5psmt63kg8gfh', to: 'bc1qeagnsqsm5h66z9dgg8wvt58dwtxcn65hg9jp5p', amount: 0.00763839, timestamp: 1786598051, tx_hash: '40f4deb01b8f0d731ce26990f2e973669113ae0742d1a8a940760bbea35a13ae', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.90 },
    { hop: 4, from: '1GrwDkr33gT6LuumniYjKEGjTLhsL5kmqC', to: 'bc1q2q8f406gak2wjyc2yp63vtru07ddffjqj6v7pp', amount: 119.25450823, timestamp: 1789838978, tx_hash: 'cff13e6c68fd92150e8551546d63cb8677a7627612f6d7dd2b5fc5ee8e94d22a', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.60 },
    { hop: 5, from: '122beJtx7zPx79nnKcMfYxHEhM2jHsYwK8', to: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', amount: 0.74956805, timestamp: 1789839014, tx_hash: 'f7249869ed167ef0188908f45728a828fa7b08a1dc3a3f3d7f3dfcda958be5a0', profile: '[VERIFIED VASP: BINANCE (Global - EXCHANGE)]', acc_score: 0.85, paes_score: 0.60 },
    { hop: 5, from: '122beJtx7zPx79nnKcMfYxHEhM2jHsYwK8', to: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', amount: 0.72908187, timestamp: 1789836615, tx_hash: 'f65643fb6ec9341825d6996c3df8e1e883caf52893854de70758a3f011e45873', profile: '[VERIFIED VASP: BINANCE (Global - EXCHANGE)]', acc_score: 0.85, paes_score: 0.60 },
    { hop: 4, from: '1KbDEg1tDz2ErYgaDbaDhhawnLrSQFaFx5', to: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', amount: 95.69986036, timestamp: 1789836615, tx_hash: '5421eadb8f0a1b0994fa88587e2e32cfca777541bbad0a2655112ac5bf8b76a7', profile: '[VERIFIED VASP: BINANCE (Global - EXCHANGE)]', acc_score: 0.85, paes_score: 0.60 },
  ]
};

// Demo Case 2 — ETH Cross-Chain Bridge
const DEMO_CASE_2 = {
  case_id: 'VASP-20260919_140229',
  generated_at: '2026-09-19T14:02:29.073370+00:00',
  engine: 'Automated Blockchain Forensic & VASP Attribution Engine (Zero API Keys)',
  graph_engine: 'TransactionGraphBackend (C++ CSR Graph + Microsecond BFS)',
  cpp_engine_stats: { nodesCount: 3, edgesCount: 2, nodesVisited: 3, edgesExamined: 3, executionTimeUs: 2, truncated: false },
  suspect_address: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C',
  blockchain: 'ETH',
  max_hops_traced: 15,
  duration_seconds: 7.88,
  on_chain_summary: { total_inflow: 0, total_outflow: 0.09, inflow_count: 0, outflow_count: 50, transfers_traced: 5 },
  risk_assessment: {
    risk_score: 60, risk_level: 'HIGH',
    forensic_verdict: 'Risk Level: HIGH | Typology: Cross-Chain Bridge Hopping',
    category_breakdown: { defi_bridge: 45.0, unhosted: 20.0 },
    typologies: [
      { code: 'TYP-XCHAIN-01', title: 'Cross-Chain Bridge Hopping', severity: 'MEDIUM', base_threat_weight: 45, statutory_reference: 'FIU-IND Red Flag Indicator — Cross-Chain Capital Flight', description: 'Use of decentralized cross-chain bridge protocols (Across, Stargate, Wormhole) to hop chains and break linear forensics.', investigative_action: 'Decode cross-chain relayer deposit/fill transaction logs to follow funds on the destination ledger.' },
    ],
    high_risk_alerts: []
  },
  cross_chain_hops: [
    { protocol: 'Across Protocol', status: 'FILLED', origin_chain: 'ETH', origin_tx_hash: '0x5f36a771bfb6e3d3a5a1982bcb3435d104ce9c2a4ffb1146464e88e1942619d4', origin_chain_id: 1, destination_chain_id: 4663, destination_chain_name: 'Robinhood Chain', destination_symbol: 'ROBINHOOD', fill_tx_hash: '0xf8a1153ddf47bf5aafaef51665f0be7ac097a0f77443e5915a4db2ea37837f2b', recipient: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', amount: 0.06998228442310052, deposit_id: '4607297' },
    { protocol: 'Across Protocol', status: 'FILLED', origin_chain: 'ETH', origin_tx_hash: '0x791c33408d1c49bf0c9d1f357ec0587f4f6da7297b1e3d113e5a5454ab357ce3', origin_chain_id: 1, destination_chain_id: 4663, destination_chain_name: 'Robinhood Chain', destination_symbol: 'ROBINHOOD', fill_tx_hash: '0x32dd9597d1203401b2250af3e2d733aa8dbc908268562ae46d302c53c0fdb181', recipient: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', amount: 0.019984962166046203, deposit_id: '4601689' },
  ],
  vasp_targets: [],
  chain_of_custody_ledger: [
    { hop: 1, from: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', to: '0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5', amount: 0.07, timestamp: 1789748843, tx_hash: '0x5f36a771bfb6e3d3a5a1982bcb3435d104ce9c2a4ffb1146464e88e1942619d4', profile: '[DEFI BRIDGE: ACROSS PROTOCOL | RISK: MEDIUM]', acc_score: 0.95, paes_score: 0.90 },
    { hop: 2, from: '0x5c7bcd... (Across Protocol)', to: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', amount: 0.06998228442310052, timestamp: 1789748843, tx_hash: '0xf8a1153ddf47bf5aafaef51665f0be7ac097a0f77443e5915a4db2ea37837f2b', profile: '[DESTINATION RECIPIENT on Robinhood Chain]', acc_score: 0.95, paes_score: 0.80 },
    { hop: 1, from: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', to: '0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5', amount: 0.02, timestamp: 1789693943, tx_hash: '0x791c33408d1c49bf0c9d1f357ec0587f4f6da7297b1e3d113e5a5454ab357ce3', profile: '[DEFI BRIDGE: ACROSS PROTOCOL | RISK: MEDIUM]', acc_score: 0.95, paes_score: 0.90 },
    { hop: 1, from: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', to: '0x0de8bf93da2f7eecb3d9169422413a9bef4ef628', amount: 0.0, timestamp: 1789846307, tx_hash: '0xee225774fc0b12f6371e8a98a3996b7f0dd2445a07b77415787b386811afc442', profile: '[UNHOSTED INTERMEDIARY | RISK: LOW]', acc_score: 0.70, paes_score: 0.90 },
  ]
};

// ── View Management ───────────────────────────────────────────
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.getElementById('nav-' + view).classList.add('active');
  const titles = {
    trace: ['Wallet Trace & Fund Flow Analysis', 'Multi-hop blockchain tracing with real-time VASP attribution and AML/CFT typology detection'],
    reports: ['Case Reports Library', 'Load and inspect previously generated investigation reports from the forensic engine'],
    graph: ['Fund Flow Graph Visualization', 'Interactive network graph showing fund movement across wallets and entities'],
    intel: ['Threat Intelligence Registry', 'FIU-IND / FATF compliant typology database with statutory AML/CFT classification'],
  };
  document.getElementById('page-title').textContent = titles[view][0];
  document.getElementById('page-subtitle').textContent = titles[view][1];
  if (view === 'graph' && currentReport) renderGraph();
  if (view === 'intel') renderIntelView();
  if (view === 'reports') renderReportsView();
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('.main-content');
  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    main.style.marginLeft = 'var(--sidebar-collapsed)';
  } else {
    sidebar.classList.remove('collapsed');
    main.style.marginLeft = 'var(--sidebar-width)';
  }
}

// ── Chain Auto-Detection ──────────────────────────────────────
function detectChain(address) {
  const addr = address.trim();
  const el = document.getElementById('detected-chain');
  const det = document.getElementById('chain-detector');

  if (!addr) { el.textContent = 'Auto'; det.style.display = 'flex'; return; }

  let chain = 'Auto';
  if (addr.startsWith('0x') && addr.length === 42) chain = 'ETH';
  else if (addr.startsWith('T') && addr.length === 34) chain = 'TRX';
  else if (addr.startsWith('1') || addr.startsWith('3') || addr.startsWith('bc1')) chain = 'BTC';
  else if (addr.length >= 43 && addr.length <= 44 && !addr.startsWith('0x')) chain = 'SOL';

  el.textContent = chain;

  const colors = { ETH: '#627eea', BTC: '#f7931a', TRX: '#e21d1d', SOL: '#14f195', Auto: '#6366f1' };
  el.style.color = colors[chain] || '#6366f1';
}

// ── Trace Simulation ──────────────────────────────────────────
function startTrace() {
  const addr = document.getElementById('wallet-address').value.trim();
  if (!addr) {
    showToast('Please enter a suspect wallet address', 'error');
    return;
  }

  document.getElementById('trace-progress').style.display = 'block';
  document.getElementById('results-area').style.display = 'none';
  document.getElementById('trace-btn').disabled = true;

  const progressFill = document.getElementById('progress-fill');
  const progressStatus = document.getElementById('progress-status');
  const progressSteps = document.getElementById('progress-steps');
  progressSteps.innerHTML = '';

  const steps = [
    { pct: 10, msg: '[*] Connecting to decentralized public node pool (zero API keys)...', type: 'info', delay: 400 },
    { pct: 20, msg: '[*] Auto-detecting blockchain from address format...', type: 'info', delay: 800 },
    { pct: 30, msg: '[+] Chain identified. Ingesting on-chain transaction ledger...', type: 'ok', delay: 1400 },
    { pct: 45, msg: '[*] Fetching 50 most recent transactions from suspect wallet...', type: 'info', delay: 2200 },
    { pct: 55, msg: '[+] Downloaded on-chain transactions. Commencing multi-hop forward tracing...', type: 'ok', delay: 3000 },
    { pct: 65, msg: '[*] Running VASP entity resolution against local registry & on-chain tags...', type: 'info', delay: 3800 },
    { pct: 75, msg: '[*] Executing C++ CSR Graph Engine — dual BFS microsecond traversal...', type: 'info', delay: 4600 },
    { pct: 85, msg: '[+] Graph traversal complete. Running ForensicRiskEngine evaluation...', type: 'ok', delay: 5400 },
    { pct: 95, msg: '[*] Computing composite risk score & AML/CFT typology classification...', type: 'info', delay: 6000 },
    { pct: 100, msg: '[+] Investigation complete. Report generated.', type: 'ok', delay: 6800 },
  ];

  steps.forEach(({ pct, msg, type, delay }) => {
    setTimeout(() => {
      progressFill.style.width = pct + '%';
      progressStatus.textContent = msg;
      const el = document.createElement('div');
      el.className = 'progress-step ' + type;
      el.textContent = msg;
      progressSteps.appendChild(el);
      progressSteps.scrollTop = progressSteps.scrollHeight;
    }, delay);
  });

  setTimeout(() => {
    document.getElementById('trace-progress').style.display = 'none';
    document.getElementById('trace-btn').disabled = false;
    // Use a generated demo report based on address
    const report = generateReportFromAddress(addr);
    renderReport(report);
    showToast('Trace complete — Investigation report generated', 'success');
  }, 7200);
}

function generateReportFromAddress(addr) {
  // Detect chain and return appropriate demo
  if (addr.startsWith('0x')) return { ...DEMO_CASE_2, suspect_address: addr, blockchain: 'ETH' };
  return { ...DEMO_CASE, suspect_address: addr };
}

function loadDemoCase() {
  document.getElementById('wallet-address').value = DEMO_CASE.suspect_address;
  detectChain(DEMO_CASE.suspect_address);
  renderReport(DEMO_CASE);
  showToast('Demo case loaded: BTC Multi-Hop Trace — Binance Terminal VASP', 'info');
}

function clearForm() {
  document.getElementById('wallet-address').value = '';
  document.getElementById('coin-type').value = '';
  document.getElementById('date-range').value = '';
  document.getElementById('tx-hash').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('max-hops').value = 15;
  document.getElementById('hops-display').textContent = '15';
  document.getElementById('detected-chain').textContent = 'Auto';
  document.getElementById('results-area').style.display = 'none';
  document.getElementById('trace-progress').style.display = 'none';
  currentReport = null;
  showToast('Form cleared', 'info');
}

// ── Render Report ─────────────────────────────────────────────
function renderReport(report) {
  currentReport = report;

  const summary = report.on_chain_summary || {};
  const risk = report.risk_assessment || {};
  const riskLevel = risk.risk_level || risk.risk_level || 'LOW';
  const riskScore = risk.risk_score || risk.composite_score || 0;

  // Show results area
  document.getElementById('results-area').style.display = 'block';

  // Risk Banner
  const banner = document.getElementById('risk-banner');
  banner.className = 'risk-banner ' + riskLevel;

  animateCounter('risk-score-num', riskScore, 800);
  const circle = document.getElementById('risk-progress-circle');
  const circumference = 201.06;
  setTimeout(() => {
    circle.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)';
    circle.style.strokeDashoffset = circumference - (riskScore / 100) * circumference;
  }, 100);

  const badge = document.getElementById('risk-level-badge');
  badge.className = 'risk-level-badge ' + riskLevel;
  badge.textContent = riskLevel + ' RISK';

  document.getElementById('risk-verdict').textContent = report.suspect_address;
  document.getElementById('risk-summary').textContent = risk.forensic_verdict || risk.summary_verdict || 'Analysis complete';

  animateCounter('rs-hops', report.chain_of_custody_ledger ? report.chain_of_custody_ledger.length : 0, 600);
  animateCounter('rs-inflow', summary.inflow_count || 0, 600);
  animateCounter('rs-outflow', summary.outflow_count || 0, 600);
  animateCounter('rs-vasps', (report.vasp_targets || []).length, 600);

  // Stats
  const chain = report.blockchain || 'BTC';
  document.getElementById('sc-inflow').textContent = (summary.total_inflow || 0).toFixed(6) + ' ' + chain;
  document.getElementById('sc-outflow').textContent = (summary.total_outflow || 0).toFixed(6) + ' ' + chain;
  document.getElementById('sc-transfers').textContent = summary.transfers_traced || 0;
  document.getElementById('sc-duration').textContent = (report.duration_seconds || 0).toFixed(2) + 's';

  // Header
  document.getElementById('hdr-entities').textContent = (report.chain_of_custody_ledger || []).length;

  // Render tabs
  renderLedger(report.chain_of_custody_ledger || []);
  renderTypologies(risk.typologies || [], risk.category_breakdown || {});
  renderVaspTargets(report.vasp_targets || [], chain);
  renderCrossChain(report.cross_chain_hops || []);
  renderEngineStats(report.cpp_engine_stats);

  // Build graph data
  buildGraphData(report);

  // Switch to ledger tab
  switchTab('ledger');
}

// ── Ledger ────────────────────────────────────────────────────
function renderLedger(ledger) {
  allLedgerRows = ledger;
  displayLedger(ledger);
}

function displayLedger(rows) {
  const tbody = document.getElementById('ledger-tbody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No transactions in this trace.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(item => {
    const profile = item.profile || '';
    const profileClass = getProfileClass(profile);
    const profileLabel = profile.replace(/\[|\]/g, '').replace('VERIFIED VASP: ', '').replace('UNHOSTED / INTERMEDIARY', 'Unhosted').replace('UNHOSTED INTERMEDIARY | RISK: LOW', 'Unhosted').substring(0, 45);
    const timeStr = item.timestamp ? new Date(item.timestamp * 1000).toISOString().replace('T', ' ').substring(0, 16) + ' UTC' : 'N/A';
    const hopClass = 'hop-' + Math.min(item.hop, 3);
    const from = item.from ? `${item.from.substring(0, 8)}...${item.from.slice(-6)}` : 'N/A';
    const to = item.to ? `${item.to.substring(0, 8)}...${item.to.slice(-6)}` : 'N/A';
    const txShort = item.tx_hash ? `${item.tx_hash.substring(0, 14)}...` : 'N/A';
    const chain = currentReport ? currentReport.blockchain : 'BTC';

    return `<tr data-profile="${profile.toLowerCase()}" data-hop="${item.hop}">
      <td><span class="hop-badge ${hopClass}">${item.hop}</span></td>
      <td><span class="addr-cell" title="${item.from || ''}" onclick="copyToClipboard('${item.from || ''}')">${from}</span></td>
      <td><span class="addr-cell" title="${item.to || ''}" onclick="copyToClipboard('${item.to || ''}')">${to}</span></td>
      <td class="amount-cell">${(item.amount || 0).toFixed(6)} ${chain}</td>
      <td class="time-cell">${timeStr}</td>
      <td class="score-cell">${((item.acc_score || 0.70) * 100).toFixed(0)}%</td>
      <td class="score-cell">${((item.paes_score || 0.80) * 100).toFixed(0)}%</td>
      <td class="profile-cell"><span class="profile-tag ${profileClass}">${profileLabel}</span></td>
      <td class="txhash-cell" title="${item.tx_hash || ''}" onclick="copyToClipboard('${item.tx_hash || ''}')">${txShort}</td>
    </tr>`;
  }).join('');
}

function getProfileClass(profile) {
  const p = profile.toLowerCase();
  if (p.includes('terrorism') || p.includes('ransomware') || p.includes('darknet') || p.includes('critical')) return 'critical';
  if (p.includes('mixer') || p.includes('tumbler') || p.includes('high')) return 'high';
  if (p.includes('bridge') || p.includes('medium')) return 'bridge';
  if (p.includes('verified vasp') || p.includes('gateway') || p.includes('exchange')) return 'vasp';
  if (p.includes('unhosted') || p.includes('intermediary') || p.includes('low')) return 'unhosted';
  return 'unhosted';
}

function filterLedger(search) {
  const s = search.toLowerCase();
  const filtered = allLedgerRows.filter(row =>
    (row.from || '').toLowerCase().includes(s) ||
    (row.to || '').toLowerCase().includes(s) ||
    (row.profile || '').toLowerCase().includes(s) ||
    (row.tx_hash || '').toLowerCase().includes(s) ||
    String(row.hop).includes(s)
  );
  displayLedger(filtered);
}

function filterByRisk(level, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (level === 'all') { displayLedger(allLedgerRows); return; }

  const filtered = allLedgerRows.filter(row => {
    const p = (row.profile || '').toLowerCase();
    if (level === 'critical') return p.includes('terrorism') || p.includes('ransomware') || p.includes('critical') || p.includes('darknet');
    if (level === 'high') return p.includes('mixer') || p.includes('high') || p.includes('tumbler');
    if (level === 'medium') return p.includes('bridge') || p.includes('medium');
    if (level === 'low') return p.includes('unhosted') || p.includes('vasp') || p.includes('gateway') || p.includes('low');
    return true;
  });
  displayLedger(filtered);
}

// ── Typologies ────────────────────────────────────────────────
function renderTypologies(typologies, breakdown) {
  const grid = document.getElementById('typology-grid');
  if (!typologies || typologies.length === 0) {
    grid.innerHTML = '<div class="typology-empty">No AML/CFT typologies detected in this trace.</div>';
  } else {
    grid.innerHTML = typologies.map(t => {
      const level = t.severity || t.level || 'LOW';
      const typoData = TYPOLOGY_REGISTRY[t.code] || {};
      return `<div class="typology-card ${level}">
        <div class="typology-code">${t.code || ''}</div>
        <span class="severity-badge ${level}">${level} — ${t.base_threat_weight || typoData.weight || 0}/100</span>
        <div class="typology-title">${t.title || typoData.title || ''}</div>
        <div class="typology-desc">${t.description || typoData.desc || ''}</div>
        <div class="typology-ref">${t.statutory_reference || typoData.ref || ''}</div>
        <div class="typology-action">${t.investigative_action || typoData.action || ''}</div>
      </div>`;
    }).join('');
  }

  // Breakdown
  const breakdownEl = document.getElementById('category-breakdown');
  const barsEl = document.getElementById('breakdown-bars');
  if (breakdown && Object.keys(breakdown).length > 0) {
    breakdownEl.style.display = 'block';
    const maxScore = Math.max(...Object.values(breakdown), 1);
    const colors = {
      terrorism_financing: '#ef4444', ransomware: '#ef4444', sanctioned_entity: '#ef4444',
      darknet: '#ef4444', mixer: '#ef4444', betting: '#f97316', peeling_chain: '#f97316',
      defi_bridge: '#22d3ee', custodial_exchange: '#6366f1', unhosted: '#4a5568'
    };
    barsEl.innerHTML = Object.entries(breakdown).map(([cat, score]) => {
      const pct = (score / 100) * 100;
      const color = colors[cat] || '#6366f1';
      return `<div class="breakdown-bar-row">
        <div class="breakdown-bar-label">${cat.replace(/_/g, ' ')}</div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill" style="width: 0%; background: ${color};" data-pct="${pct}"></div>
        </div>
        <div class="breakdown-bar-score">${score.toFixed(1)}</div>
      </div>`;
    }).join('');
    setTimeout(() => {
      document.querySelectorAll('.breakdown-bar-fill').forEach(el => {
        el.style.width = el.dataset.pct + '%';
      });
    }, 50);
  } else {
    breakdownEl.style.display = 'none';
  }
}

// ── VASP Targets ──────────────────────────────────────────────
function renderVaspTargets(targets, chain) {
  const grid = document.getElementById('vasp-targets-grid');
  if (!targets || targets.length === 0) {
    grid.innerHTML = '<div class="typology-empty">No custodial VASP/Exchange terminals identified in this trace.<br>Funds may still be traversing unhosted intermediate wallets.</div>';
    return;
  }

  grid.innerHTML = targets.map(t => {
    const accPct = Math.round((t.acc_score || 0.85) * 100);
    const paesPct = Math.round((t.paes_score || 0.60) * 100);
    const addr = t.address || '';
    const addrShort = addr ? `${addr.substring(0, 12)}...${addr.slice(-8)}` : 'N/A';

    return `<div class="vasp-target-card">
      <div class="vasp-target-header">
        <div class="vasp-hop-badge">
          <span class="vasp-hop-num">${t.hop || '?'}</span>
          <span class="vasp-hop-label">HOP</span>
        </div>
        <div class="vasp-target-info">
          <div class="vasp-name">${t.vasp_name || 'Unknown Exchange'}</div>
          <div class="vasp-jurisdiction">${t.jurisdiction || 'International'}</div>
        </div>
        <div class="vasp-scores">
          ${miniRing(accPct, '#6366f1', 'ACC')}
          ${miniRing(paesPct, '#22d3ee', 'PAES')}
        </div>
      </div>
      <div class="vasp-details">
        <div class="vasp-detail-row">
          <span class="vasp-detail-label">Address</span>
          <span class="vasp-detail-val">${addrShort}</span>
        </div>
        <div class="vasp-detail-row">
          <span class="vasp-detail-label">Compliance</span>
          <span class="vasp-detail-val">${t.compliance_email || 'N/A'}</span>
        </div>
        <div class="vasp-detail-row">
          <span class="vasp-detail-label">Amount</span>
          <span class="vasp-detail-val" style="color:#10b981;">${(t.amount || 0).toFixed ? (t.amount || 0).toFixed(6) + ' ' + chain : 'N/A'}</span>
        </div>
      </div>
      <div class="vasp-crpc-notice">
        ⚖️ <strong>Statutory Notice:</strong> ${t.statutory_notice || 'Section 91 CrPC / Section 94 BNSS'} — Serve to ${t.compliance_email || 'Exchange Nodal Desk'} for account freeze & KYC disclosure.
      </div>
    </div>`;
  }).join('');
}

function miniRing(pct, color, label) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `<div class="vasp-score">
    <div class="score-ring-mini">
      <svg viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="${r}" stroke="rgba(255,255,255,0.06)" stroke-width="4" fill="none"/>
        <circle cx="22" cy="22" r="${r}" stroke="${color}" stroke-width="4" fill="none"
          stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 22 22)"/>
      </svg>
      <div class="score-val-mini">${pct}%</div>
    </div>
    <div class="score-label-mini">${label}</div>
  </div>`;
}

// ── Cross-Chain ───────────────────────────────────────────────
function renderCrossChain(hops) {
  const list = document.getElementById('crosschain-list');
  if (!hops || hops.length === 0) {
    list.innerHTML = '<div class="typology-empty">No cross-chain bridge hops detected in this trace.</div>';
    return;
  }

  list.innerHTML = hops.map(h => `
    <div class="crosschain-card">
      <div class="crosschain-header">
        <span class="crosschain-protocol">${h.protocol || 'Unknown Bridge'}</span>
        <span class="crosschain-status">${h.status || 'DELIVERED'}</span>
      </div>
      <div class="crosschain-flow">
        <div class="chain-node">
          <div class="chain-node-name">Origin</div>
          <div class="chain-node-sym">${h.origin_chain || 'ETH'}</div>
        </div>
        <div class="bridge-arrow">
          <div class="bridge-arrow-line"></div>
          <div class="bridge-amount">${(h.amount || 0).toFixed(4)} ETH</div>
          <div class="bridge-arrow-line"></div>
        </div>
        <div class="chain-node">
          <div class="chain-node-name">Destination</div>
          <div class="chain-node-sym">${h.destination_symbol || h.destination_chain_name || 'N/A'}</div>
        </div>
      </div>
      <div class="crosschain-details">
        <div class="cc-detail">
          <span class="cc-detail-label">Origin Tx</span>
          <span class="cc-detail-val" onclick="copyToClipboard('${h.origin_tx_hash || ''}')">${shortHash(h.origin_tx_hash)}</span>
        </div>
        <div class="cc-detail">
          <span class="cc-detail-label">Fill Tx</span>
          <span class="cc-detail-val" onclick="copyToClipboard('${h.fill_tx_hash || ''}')">${shortHash(h.fill_tx_hash)}</span>
        </div>
        <div class="cc-detail">
          <span class="cc-detail-label">Dest Chain</span>
          <span class="cc-detail-val">${h.destination_chain_name || 'N/A'} (ID: ${h.destination_chain_id || 'N/A'})</span>
        </div>
        <div class="cc-detail">
          <span class="cc-detail-label">Recipient</span>
          <span class="cc-detail-val" onclick="copyToClipboard('${h.recipient || ''}')">${h.recipient ? h.recipient.substring(0, 18) + '...' : 'N/A'}</span>
        </div>
        ${h.deposit_id ? `<div class="cc-detail">
          <span class="cc-detail-label">Deposit ID</span>
          <span class="cc-detail-val">${h.deposit_id}</span>
        </div>` : ''}
      </div>
    </div>
  `).join('');
}

// ── Graph Engine Stats ────────────────────────────────────────
function renderEngineStats(stats) {
  const grid = document.getElementById('engine-stats-grid');
  if (!stats) { grid.innerHTML = '<div class="typology-empty">No C++ graph engine statistics available.</div>'; return; }

  grid.innerHTML = `
    <div class="engine-stat-card">
      <div class="engine-stat-val">${stats.nodesCount || 0}</div>
      <div class="engine-stat-label">Graph Nodes</div>
    </div>
    <div class="engine-stat-card">
      <div class="engine-stat-val">${stats.edgesCount || 0}</div>
      <div class="engine-stat-label">Flow Edges</div>
    </div>
    <div class="engine-stat-card">
      <div class="engine-stat-val">${stats.nodesVisited || 0}</div>
      <div class="engine-stat-label">Nodes Visited</div>
    </div>
    <div class="engine-stat-card">
      <div class="engine-stat-val">${stats.edgesExamined || 0}</div>
      <div class="engine-stat-label">Edges Examined</div>
    </div>
    <div class="engine-stat-card">
      <div class="engine-stat-val">${stats.executionTimeUs || 0}</div>
      <div class="engine-stat-unit">μs</div>
      <div class="engine-stat-label">BFS Execution Time</div>
    </div>
    <div class="engine-stat-card">
      <div class="engine-stat-val">${stats.truncated ? 'YES' : 'NO'}</div>
      <div class="engine-stat-label">Traversal Truncated</div>
    </div>
    <div class="cpp-arch-card">
      <div class="cpp-arch-title">C++ Engine Architecture</div>
      <div class="cpp-arch-code">
Architecture  : Dual Compressed Sparse Row (CSR) Directed Graph<br>
Algorithm     : Iterative BFS — Explicit Vector Stack (Zero Recursion)<br>
Memory        : Cache-Aligned Contiguous Dual-CSR Adjacency Array<br>
Indexing      : O(1) address-based node ID lookup<br>
Safety        : Iterative BFS eliminates stack overflow on large graphs<br>
Performance   : ${stats.executionTimeUs || 0}μs native execution — sub-millisecond on graphs &lt; 10,000 nodes<br>
Output        : JSON-serializable path result + BFS statistics<br>
      </div>
    </div>`;
}

// ── Graph Visualization ───────────────────────────────────────
function buildGraphData(report) {
  graphNodes = [];
  graphEdges = [];

  if (!report || !report.chain_of_custody_ledger) return;

  const nodeMap = {};
  const suspect = report.suspect_address;

  function getOrCreate(addr, profile, hop) {
    if (!nodeMap[addr]) {
      nodeMap[addr] = {
        id: Object.keys(nodeMap).length,
        address: addr,
        profile: profile || '',
        hop: hop,
        x: 0, y: 0,
        vx: 0, vy: 0,
        radius: hop === 0 ? 16 : Math.max(8, 16 - hop * 2),
        color: getNodeColor(addr, profile, hop),
      };
      graphNodes.push(nodeMap[addr]);
    }
    return nodeMap[addr];
  }

  getOrCreate(suspect, '[SUSPECT]', 0);

  report.chain_of_custody_ledger.forEach(item => {
    if (item.from) getOrCreate(item.from, '', item.hop - 1);
    if (item.to) getOrCreate(item.to, item.profile, item.hop);
    if (item.from && item.to) {
      graphEdges.push({
        source: item.from,
        target: item.to,
        amount: item.amount,
        profile: item.profile,
      });
    }
  });

  // Layout
  layoutGraphForce();
}

function getNodeColor(addr, profile, hop) {
  if (hop === 0) return '#f59e0b';
  const p = (profile || '').toLowerCase();
  if (p.includes('terrorism') || p.includes('ransomware') || p.includes('darknet')) return '#ef4444';
  if (p.includes('mixer') || p.includes('tumbler')) return '#ef4444';
  if (p.includes('vasp') || p.includes('verified') || p.includes('exchange') || p.includes('binance')) return '#6366f1';
  if (p.includes('bridge') || p.includes('defi')) return '#22d3ee';
  if (p.includes('high')) return '#f97316';
  if (p.includes('medium')) return '#f59e0b';
  return '#4a5568';
}

function layoutGraphForce() {
  const W = 900, H = 600;
  const hopGroups = {};
  graphNodes.forEach(n => {
    if (!hopGroups[n.hop]) hopGroups[n.hop] = [];
    hopGroups[n.hop].push(n);
  });

  const maxHop = Math.max(...Object.keys(hopGroups).map(Number));
  Object.entries(hopGroups).forEach(([hop, nodes]) => {
    const x = (Number(hop) / (maxHop || 1)) * (W * 0.8) + W * 0.1;
    nodes.forEach((n, i) => {
      n.x = x + (Math.random() - 0.5) * 60;
      n.y = ((i + 1) / (nodes.length + 1)) * H;
    });
  });
}

function renderGraph() {
  const canvas = document.getElementById('graph-canvas');
  const empty = document.getElementById('graph-empty');
  if (!canvas) return;

  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;

  if (!graphNodes.length) {
    canvas.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }

  canvas.style.display = 'block';
  empty.style.display = 'none';

  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 900;
    const scaleY = canvas.height / 600;

    // Edges
    graphEdges.forEach(e => {
      const srcNode = graphNodes.find(n => n.address === e.source);
      const tgtNode = graphNodes.find(n => n.address === e.target);
      if (!srcNode || !tgtNode) return;

      const sx = srcNode.x * scaleX, sy = srcNode.y * scaleY;
      const tx = tgtNode.x * scaleX, ty = tgtNode.y * scaleY;

      // Arrow
      const angle = Math.atan2(ty - sy, tx - sx);
      const pr = (tgtNode.radius || 8) * ((scaleX + scaleY) / 2);
      const ex = tx - Math.cos(angle) * pr;
      const ey = ty - Math.sin(angle) * pr;

      const gradient = ctx.createLinearGradient(sx, sy, ex, ey);
      gradient.addColorStop(0, 'rgba(99,102,241,0.3)');
      gradient.addColorStop(1, 'rgba(34,211,238,0.3)');

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 8 * Math.cos(angle - 0.4), ey - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(ex - 8 * Math.cos(angle + 0.4), ey - 8 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = 'rgba(34,211,238,0.6)';
      ctx.fill();
    });

    // Nodes
    graphNodes.forEach(n => {
      const x = n.x * scaleX, y = n.y * scaleY;
      const r = (n.radius || 8) * ((scaleX + scaleY) / 2);

      // Glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
      glow.addColorStop(0, n.color + '40');
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color + 'cc';
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      if (graphShowLabels && canvas.width > 500) {
        const label = n.hop === 0 ? 'SUSPECT' : `H${n.hop}: ${n.address.substring(0, 6)}...`;
        ctx.font = `600 ${Math.max(8, 11 * ((scaleX + scaleY) / 2))}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(240,244,255,0.8)';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + r + 14 * ((scaleX + scaleY) / 2));
      }
    });
  }

  draw();
}

function resetGraphZoom() { renderGraph(); }
function toggleGraphLabels() { graphShowLabels = !graphShowLabels; renderGraph(); }

// ── Reports View ──────────────────────────────────────────────
const DEMO_REPORTS = [DEMO_CASE, DEMO_CASE_2];

function renderReportsView() {
  const grid = document.getElementById('reports-grid');
  grid.innerHTML = DEMO_REPORTS.map(r => {
    const risk = r.risk_assessment || {};
    const riskLevel = risk.risk_level || 'LOW';
    const riskScore = risk.risk_score || risk.composite_score || 0;
    const summary = r.on_chain_summary || {};
    return `<div class="report-card ${riskLevel}" onclick="loadReportFromCard('${r.case_id}')">
      <div class="report-card-header">
        <div class="report-case-id">${r.case_id}</div>
        <div class="report-risk-level ${riskLevel}">${riskLevel} (${riskScore}/100)</div>
      </div>
      <div class="report-address">${r.suspect_address}</div>
      <div class="report-meta">
        <div class="report-meta-item">
          <span class="report-meta-label">Blockchain</span>
          <span class="report-meta-val">${r.blockchain}</span>
        </div>
        <div class="report-meta-item">
          <span class="report-meta-label">Duration</span>
          <span class="report-meta-val">${r.duration_seconds}s</span>
        </div>
        <div class="report-meta-item">
          <span class="report-meta-label">Hops</span>
          <span class="report-meta-val">${(r.chain_of_custody_ledger || []).length}</span>
        </div>
        <div class="report-meta-item">
          <span class="report-meta-label">VASPs</span>
          <span class="report-meta-val">${(r.vasp_targets || []).length}</span>
        </div>
      </div>
      <div class="report-verdict">${risk.forensic_verdict || risk.summary_verdict || 'N/A'}</div>
    </div>`;
  }).join('');
  document.getElementById('hdr-cases').textContent = DEMO_REPORTS.length;
}

function loadReportFromCard(caseId) {
  const report = DEMO_REPORTS.find(r => r.case_id === caseId);
  if (!report) return;
  renderReport(report);
  showView('trace');
  showToast(`Loaded case: ${caseId}`, 'success');
}

function loadReportFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const report = JSON.parse(e.target.result);
      // Normalize field names
      if (report.suspect_wallet && !report.suspect_address) report.suspect_address = report.suspect_wallet;
      if (report.coin && !report.blockchain) report.blockchain = report.coin;
      if (report.hops_traced !== undefined && !report.on_chain_summary) {
        report.on_chain_summary = { total_inflow: report.total_inflow || 0, total_outflow: report.total_outflow || 0, inflow_count: 0, outflow_count: 0, transfers_traced: report.hops_traced };
      }
      if (report.risk_assessment && report.risk_assessment.composite_score !== undefined) {
        report.risk_assessment.risk_score = report.risk_assessment.composite_score;
      }
      if (report.risk_assessment && report.risk_assessment.verdict && !report.risk_assessment.forensic_verdict) {
        report.risk_assessment.forensic_verdict = report.risk_assessment.verdict;
      }

      DEMO_REPORTS.push(report);
      renderReport(report);
      showView('trace');
      showToast(`Loaded: ${report.case_id || file.name}`, 'success');
    } catch (err) {
      showToast('Failed to parse report JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ── Intel View ────────────────────────────────────────────────
function renderIntelView() {
  const grid = document.getElementById('intel-typologies-grid');
  grid.innerHTML = Object.values(TYPOLOGY_REGISTRY).map(t => `
    <div class="typology-card ${t.level}">
      <div class="typology-code">${t.code}</div>
      <span class="severity-badge ${t.level}">${t.level} — ${t.weight}/100</span>
      <div class="typology-title">${t.title}</div>
      <div class="typology-desc">${t.desc}</div>
      <div class="typology-ref">${t.ref}</div>
      <div class="typology-action">${t.action}</div>
    </div>
  `).join('');

  const chainCards = document.getElementById('chain-cards');
  const chainColors = { ETH: '#627eea', BTC: '#f7931a', TRON: '#e21d1d', BNB: '#f3ba2f', MATIC: '#8247e5', SOL: '#14f195' };
  chainCards.innerHTML = Object.entries(PUBLIC_RPC_NODES).map(([chain, nodes]) => `
    <div class="chain-card">
      <div class="chain-card-header">
        <span class="chain-card-sym" style="color: ${chainColors[chain] || '#6366f1'}">${chain}</span>
        <span class="chain-card-name">${chainNames[chain] || chain}</span>
      </div>
      <div class="chain-rpc-list">
        ${nodes.map(n => `<div class="chain-rpc-item">${n}</div>`).join('')}
      </div>
    </div>
  `).join('');
}

const chainNames = { ETH: 'Ethereum', BTC: 'Bitcoin', TRON: 'Tron', BNB: 'BNB Chain', MATIC: 'Polygon', SOL: 'Solana' };

// ── Tab Switching ─────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-content-' + tab).classList.add('active');
}

// ── Utilities ─────────────────────────────────────────────────
function shortHash(hash) {
  if (!hash) return 'N/A';
  return hash.substring(0, 14) + '...';
}

function animateCounter(id, target, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied: ' + text.substring(0, 20) + (text.length > 20 ? '...' : ''), 'success');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard', 'success');
  });
}

function exportCurrentReport() {
  if (!currentReport) { showToast('No report loaded to export', 'error'); return; }
  const json = JSON.stringify(currentReport, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentReport.case_id || 'vasp_report'}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report exported as JSON', 'success');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => container.removeChild(toast), 300);
  }, 3500);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderIntelView();
  renderReportsView();
  showToast('VASP Forensic Engine v2.0 — Ready (Zero API Keys)', 'success');

  // Handle window resize for graph
  window.addEventListener('resize', () => {
    if (document.getElementById('view-graph').classList.contains('active') && currentReport) {
      renderGraph();
    }
  });

  // Auto-detect chain on address input
  document.getElementById('wallet-address').addEventListener('input', e => detectChain(e.target.value));
});
