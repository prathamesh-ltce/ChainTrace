import { TYPOLOGY_REGISTRY, PUBLIC_RPC_NODES } from '../data/constants'

const CHAIN_COLORS = {
 ETH: '#627eea', BTC: '#f7931a', TRON: '#e21d1d',
 BNB: '#f0b90b', MATIC: '#8247e5', SOL: '#14f195'
}

const LEVEL_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function IntelPage() {
 const typologies = Object.values(TYPOLOGY_REGISTRY).sort((a, b) =>
  LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
 )

 return (
  <div>
   <div className="panel mb-20">
    <div className="panel-header">
     <div>
      <div className="panel-title">Threat Intelligence Registry</div>
      <div className="panel-sub">FIU-IND / FATF compliant typology database with statutory AML/CFT classification</div>
     </div>
     <span className="risk-pill CRITICAL" style={{ fontSize: '0.62rem' }}>{typologies.length} Typologies</span>
    </div>
    <div className="panel-body">
     <div className="intel-typology-grid">
      {typologies.map(t => (
       <div key={t.code} className="intel-card">
        <div className="intel-card-header">
         <div>
          <div className="intel-code">{t.code}</div>
          <div className="intel-title">{t.title}</div>
         </div>
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className={"risk-pill " + t.level}>{t.level}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--indigo-light)', fontWeight: 700 }}>{t.weight}</span>
         </div>
        </div>
        <div className="score-bar mb-8">
         <div className="score-fill" style={{ width: t.weight + '%' }} />
        </div>
        <div style={{ fontSize: '0.62rem', color: 'var(--indigo)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{t.ref}</div>
        <div className="intel-desc">{t.desc}</div>
        <div className="intel-action">Action: {t.action}</div>
       </div>
      ))}
     </div>
    </div>
   </div>

   <div className="panel">
    <div className="panel-header">
     <div className="panel-title">Supported Chains & RPC Nodes</div>
    </div>
    <div className="panel-body">
     <div className="chain-nodes-grid">
      {Object.entries(PUBLIC_RPC_NODES).map(([chain, nodes]) => (
       <div key={chain} className="chain-node-card">
        <div className="chain-dot" style={{ background: CHAIN_COLORS[chain] || 'var(--indigo)' }} />
        <div>
         <div className="chain-name">{chain}</div>
         <div className="rpc-list">{nodes.slice(0, 2).join('\n')}</div>
        </div>
       </div>
      ))}
     </div>
    </div>
   </div>
  </div>
 )
}
