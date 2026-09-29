// ── Typology Registry ─────────────────────────────────────────
export const TYPOLOGY_REGISTRY = {
 'TYP-CFT-01': { code: 'TYP-CFT-01', title: 'Terrorism Financing Risk', level: 'CRITICAL', weight: 100, ref: 'UAPA Sec 51A / PMLA Sec 3', desc: 'Direct or indirect linkage with addresses designated under UAPA / UNSC 1267.', action: 'Immediate freeze request via FIU-IND / NIA escalation / UNSC designated asset freeze.' },
 'TYP-CYBER-01': { code: 'TYP-CYBER-01', title: 'Ransomware Extortion Proceeds', level: 'CRITICAL', weight: 95, ref: 'IT Act Section 66 / 66F', desc: 'Funds linked to ransomware extortion campaigns (LockBit, WannaCry, BlackCat, Conti).', action: 'Coordinate with CERT-In and international law enforcement (Interpol / FBI IC3) to track cash-out points.' },
 'TYP-SANCT-01': { code: 'TYP-SANCT-01', title: 'International Sanctioned Entity', level: 'CRITICAL', weight: 95, ref: 'UN Security Council Act / MEA Directives', desc: 'Interaction with addresses on OFAC SDN, EU, or UN sanctions lists including DPRK Lazarus Group.', action: 'Issue formal blacklisting notification to all domestic reporting entities.' },
 'TYP-DNM-01': { code: 'TYP-DNM-01', title: 'Darknet Marketplace Contraband', level: 'CRITICAL', weight: 90, ref: 'NDPS Act / IPC Cyber Offenses', desc: 'Transactions routed to or from illicit darknet markets (Hydra, AlphaBay, Silk Road).', action: 'Procure vendor transaction identifiers and initiate NCB / Cyber Police investigation.' },
 'TYP-AML-01': { code: 'TYP-AML-01', title: 'Money Laundering via Mixer/Tumbler', level: 'CRITICAL', weight: 85, ref: 'Section 3 PMLA 2002', desc: 'Deliberate concealment and severing of blockchain audit trails via zero-knowledge or UTXO coin mixing.', action: 'Record in FIR as deliberate concealment of proceeds of crime.' },
 'TYP-FEMA-01': { code: 'TYP-FEMA-01', title: 'Illegal Offshore Betting / Gambling', level: 'HIGH', weight: 65, ref: 'FEMA / State Public Gambling Acts', desc: 'Outflows directed into unauthorized offshore betting platforms violating Indian gaming laws.', action: 'Submit domain/ISP blocking order under IT Act 69A.' },
 'TYP-PEEL-01': { code: 'TYP-PEEL-01', title: 'Peeling Chain & Rapid Layering', level: 'HIGH', weight: 60, ref: 'FATF Red Flag Indicator', desc: 'Automated sweeping where funds are rapidly fragmented across short timeframes with high split ratios.', action: 'Construct topological fund flow graph to identify the terminal consolidation or cash-out wallet.' },
 'TYP-XCHAIN-01': { code: 'TYP-XCHAIN-01', title: 'Cross-Chain Bridge Hopping', level: 'MEDIUM', weight: 45, ref: 'FIU-IND Red Flag Indicator', desc: 'Use of decentralized cross-chain bridge protocols to break linear forensics.', action: 'Decode cross-chain relayer deposit/fill transaction logs to follow funds on the destination ledger.' },
 'TYP-LAYER-01': { code: 'TYP-LAYER-01', title: 'Multi-Hop Structured Layering', level: 'MEDIUM', weight: 35, ref: 'PMLA Section 12', desc: 'Funds traversed through multiple intermediary unhosted hops without legitimate justification.', action: 'Trace forward until a custodial VASP / KYC gateway is identified.' },
 'TYP-GATEWAY-01': { code: 'TYP-GATEWAY-01', title: 'Regulated Custodial VASP Gateway', level: 'LOW', weight: 5, ref: 'Section 91 CrPC / Section 94 BNSS 2023', desc: 'Funds deposited into centralized custodial exchange offering KYC records.', action: 'Serve statutory preservation notice to Exchange Nodal Desk.' },
};

export const PUBLIC_RPC_NODES = {
 ETH: ['eth.merkle.io', 'ethereum-rpc.publicnode.com', '1rpc.io/eth'],
 BTC: ['blockstream.info/api', 'mempool.emzy.de/api', 'mempool.space/api'],
 TRON: ['api.trongrid.io', 'api.shasta.trongrid.io'],
 BNB: ['bsc-dataseed.binance.org', 'bsc-rpc.publicnode.com'],
 MATIC: ['polygon-bor-rpc.publicnode.com', '1rpc.io/matic'],
 SOL: ['api.mainnet-beta.solana.com'],
};

export const DEMO_CASE = {
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
   { code: 'TYP-PEEL-01', title: 'Peeling Chain & Rapid Layering', severity: 'HIGH', base_threat_weight: 60, statutory_reference: 'FATF Red Flag Indicator', description: 'Automated sweeping where funds are rapidly fragmented across short timeframes with high split ratios.', investigative_action: 'Construct topological fund flow graph to identify the terminal consolidation or cash-out wallet.' },
   { code: 'TYP-LAYER-01', title: 'Multi-Hop Structured Layering', severity: 'MEDIUM', base_threat_weight: 35, statutory_reference: 'PMLA Section 12', description: 'Funds traversed through multiple intermediary unhosted hops without legitimate justification.', investigative_action: 'Trace forward until a custodial VASP / KYC gateway is identified for Section 91 CrPC notice.' },
   { code: 'TYP-GATEWAY-01', title: 'Regulated Custodial VASP Gateway', severity: 'LOW', base_threat_weight: 5, statutory_reference: 'Section 91 CrPC / Section 94 BNSS 2023', description: 'Funds deposited into centralized custodial exchange Binance offering KYC records.', investigative_action: 'Serve statutory preservation notice to compliance@binance.com.' },
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
  { hop: 2, from: 'bc1qeagnsqsm5h66z9dgg8wvt58dwtxcn65hg9jp5p', to: '181MwaNUMatYbfarURsDs7WmbxD4j3e3C', amount: 0.01054662, timestamp: 1787770954, tx_hash: '90f9113d181a029ac31c71cdbd3015d6ec25ab922135e1f8d709d7afcacc60f8', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.80 },
  { hop: 3, from: '181MwaNUMatYbfarURsDs7WmbxD4j3e3C', to: '1GrwDkr33gT6LuumniYjKEGjTLhsL5kmqC', amount: 0.00936174, timestamp: 1787771625, tx_hash: 'c605f4e321311b9af785c6ad75ec9d7d55d375ffe33ba78294daf5c9f90e2192', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.70 },
  { hop: 4, from: '1GrwDkr33gT6LuumniYjKEGjTLhsL5kmqC', to: 'bc1q2q8f406gak2wjyc2yp63vtru07ddffjqj6v7pp', amount: 119.25450823, timestamp: 1789838978, tx_hash: 'cff13e6c68fd92150e8551546d63cb8677a7627612f6d7dd2b5fc5ee8e94d22a', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.60 },
  { hop: 4, from: '1GrwDkr33gT6LuumniYjKEGjTLhsL5kmqC', to: '1P7oa4iwfJfmpsZr1QL5wbGGQA5BrvBEEN', amount: 13.57309921, timestamp: 1789840784, tx_hash: '60d6e904ec17fe84443503b8d3ea6e09dc6ed185c4f5c30d2c092d751094e5ce', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.60 },
  { hop: 1, from: 'bc1q9wnz3hjqt4mms7ed7ap57zhcv5psmt63kg8gfh', to: '1EVryAntQmHCoqrEraFhFXvTbkBpzTEFxM', amount: 0.00695648, timestamp: 1787180366, tx_hash: '5f5870e315cb44ae0a9a0f3718a13efb334842dca58d4db9103348fefae644b5', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.90 },
  { hop: 2, from: '1EVryAntQmHCoqrEraFhFXvTbkBpzTEFxM', to: '12XZMdaAGmcHf4ocFSqpd8jFd1WH7RHUPs', amount: 0.00559543, timestamp: 1788276652, tx_hash: '22e5c54b426c55db98110e3a1fde3c7b6b88f48a4dfbbbfb12f04cdf472c010b', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.80 },
  { hop: 3, from: '12XZMdaAGmcHf4ocFSqpd8jFd1WH7RHUPs', to: 'bc1qlnealgkxu438syerjc3sqjrwp8ey7tjl20zhmf', amount: 119.29078224, timestamp: 1789833108, tx_hash: 'b316fa7940680154f55bed32347cb7a74e1b64a35723d480afb149baad5c9895', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.70 },
  { hop: 3, from: '12XZMdaAGmcHf4ocFSqpd8jFd1WH7RHUPs', to: 'bc1q9psj8es5zj66ktat6q7zs3acu9uugen8xsymy8', amount: 112.05496268, timestamp: 1789840049, tx_hash: '6060620288d59d4fd98616830ac16d27b2231b82a81e39ccd573115422cd8ebb', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.70 },
  { hop: 2, from: '1EVryAntQmHCoqrEraFhFXvTbkBpzTEFxM', to: '1DLeNApsHNNzUMNZJVoXeyEY5sdp8vzx3w', amount: 0.00446987, timestamp: 1788855402, tx_hash: '15aa5cf72f953eb54de9ab866b1ea91d786ba8ea17958ee9733dc392e09b6591', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.80 },
  { hop: 3, from: '1DLeNApsHNNzUMNZJVoXeyEY5sdp8vzx3w', to: 'bc1qrlv2m6qfmmpf6y8q88dqvz9m743lu3rjm3gcmh', amount: 122.8674513, timestamp: 1789830619, tx_hash: '99e2e29a0b59fb36ebfbd0dcbdd51867e118ada9bb3f4e926f1a4cbcb8fd04c2', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.70 },
  { hop: 4, from: 'bc1qrlv2m6qfmmpf6y8q88dqvz9m743lu3rjm3gcmh', to: '122beJtx7zPx79nnKcMfYxHEhM2jHsYwK8', amount: 0.00185892, timestamp: 1789832671, tx_hash: 'e607d9e487cb330061e559da64b946b626110c2f49f19143b0ce8c6a6847b470', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.60 },
  { hop: 5, from: '122beJtx7zPx79nnKcMfYxHEhM2jHsYwK8', to: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', amount: 0.74956805, timestamp: 1789839014, tx_hash: 'f7249869ed167ef0188908f45728a828fa7b08a1dc3a3f3d7f3dfcda958be5a0', profile: '[VERIFIED VASP: BINANCE (Global - EXCHANGE)]', acc_score: 0.85, paes_score: 0.60 },
  { hop: 5, from: '122beJtx7zPx79nnKcMfYxHEhM2jHsYwK8', to: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', amount: 0.72908187, timestamp: 1789836615, tx_hash: 'f65643fb6ec9341825d6996c3df8e1e883caf52893854de70758a3f011e45873', profile: '[VERIFIED VASP: BINANCE (Global - EXCHANGE)]', acc_score: 0.85, paes_score: 0.60 },
  { hop: 3, from: '1DLeNApsHNNzUMNZJVoXeyEY5sdp8vzx3w', to: '1KbDEg1tDz2ErYgaDbaDhhawnLrSQFaFx5', amount: 6.15824622, timestamp: 1789828341, tx_hash: 'b7c42a35417aa041c89cf534ca7e32e6012c97511c962be3470c199f868194bc', profile: '[UNHOSTED / INTERMEDIARY]', acc_score: 0.70, paes_score: 0.70 },
  { hop: 4, from: '1KbDEg1tDz2ErYgaDbaDhhawnLrSQFaFx5', to: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', amount: 95.69986036, timestamp: 1789836615, tx_hash: '5421eadb8f0a1b0994fa88587e2e32cfca777541bbad0a2655112ac5bf8b76a7', profile: '[VERIFIED VASP: BINANCE (Global - EXCHANGE)]', acc_score: 0.85, paes_score: 0.60 },
 ]
};

export const DEMO_CASE_2 = {
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
   { code: 'TYP-XCHAIN-01', title: 'Cross-Chain Bridge Hopping', severity: 'MEDIUM', base_threat_weight: 45, statutory_reference: 'FIU-IND Red Flag Indicator', description: 'Use of decentralized cross-chain bridge protocols to break linear forensics.', investigative_action: 'Decode cross-chain relayer deposit/fill transaction logs to follow funds on the destination ledger.' },
  ],
  high_risk_alerts: []
 },
 cross_chain_hops: [
  { protocol: 'Across Protocol', status: 'FILLED', origin_chain: 'ETH', origin_tx_hash: '0x5f36a771bfb6e3d3a5a1982bcb3435d104ce9c2a4ffb1146464e88e1942619d4', origin_chain_id: 1, destination_chain_id: 4663, destination_chain_name: 'Robinhood Chain', destination_symbol: 'ROBINHOOD', fill_tx_hash: '0xf8a1153ddf47bf5aafaef51665f0be7ac097a0f77443e5915a4db2ea37837f2b', recipient: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', amount: 0.06998228, deposit_id: '4607297' },
  { protocol: 'Across Protocol', status: 'FILLED', origin_chain: 'ETH', origin_tx_hash: '0x791c33408d1c49bf0c9d1f357ec0587f4f6da7297b1e3d113e5a5454ab357ce3', origin_chain_id: 1, destination_chain_id: 4663, destination_chain_name: 'Robinhood Chain', destination_symbol: 'ROBINHOOD', fill_tx_hash: '0x32dd9597d1203401b2250af3e2d733aa8dbc908268562ae46d302c53c0fdb181', recipient: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', amount: 0.01998496, deposit_id: '4601689' },
 ],
 vasp_targets: [],
 chain_of_custody_ledger: [
  { hop: 1, from: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', to: '0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5', amount: 0.07, timestamp: 1789748843, tx_hash: '0x5f36a771bfb6e3d3a5a1982bcb3435d104ce9c2a4ffb1146464e88e1942619d4', profile: '[DEFI BRIDGE: ACROSS PROTOCOL | RISK: MEDIUM]', acc_score: 0.95, paes_score: 0.90 },
  { hop: 2, from: '0x5c7bcd... (Across Protocol)', to: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', amount: 0.06998228, timestamp: 1789748843, tx_hash: '0xf8a1153ddf47bf5aafaef51665f0be7ac097a0f77443e5915a4db2ea37837f2b', profile: '[DESTINATION RECIPIENT on Robinhood Chain]', acc_score: 0.95, paes_score: 0.80 },
  { hop: 1, from: '0x6582b7C80dF319553a988F62436b8A1be6b2B24C', to: '0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5', amount: 0.02, timestamp: 1789693943, tx_hash: '0x791c33408d1c49bf0c9d1f357ec0587f4f6da7297b1e3d113e5a5454ab357ce3', profile: '[DEFI BRIDGE: ACROSS PROTOCOL | RISK: MEDIUM]', acc_score: 0.95, paes_score: 0.90 },
 ]
};

export const TRACE_STEPS = [
 { pct: 10, msg: 'Connecting to decentralized public node pool (zero API keys)...', type: 'info', delay: 400 },
 { pct: 20, msg: 'Auto-detecting blockchain from address format...', type: 'info', delay: 900 },
 { pct: 30, msg: 'Chain identified. Ingesting on-chain transaction ledger...', type: 'ok', delay: 1600 },
 { pct: 45, msg: 'Fetching 50 most recent transactions from suspect wallet...', type: 'info', delay: 2500 },
 { pct: 55, msg: 'Downloaded on-chain transactions. Commencing multi-hop forward tracing...', type: 'ok', delay: 3400 },
 { pct: 65, msg: 'Running VASP entity resolution against local registry & on-chain tags...', type: 'info', delay: 4200 },
 { pct: 75, msg: 'Executing C++ CSR Graph Engine - dual BFS microsecond traversal...', type: 'info', delay: 5000 },
 { pct: 85, msg: 'Graph traversal complete. Running ForensicRiskEngine evaluation...', type: 'ok', delay: 5800 },
 { pct: 95, msg: 'Computing composite risk score & AML/CFT typology classification...', type: 'info', delay: 6400 },
 { pct: 100, msg: 'Investigation complete. Report generated.', type: 'ok', delay: 7200 },
];
