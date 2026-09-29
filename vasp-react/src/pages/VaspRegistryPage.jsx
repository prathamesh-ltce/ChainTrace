import { useState, useEffect } from 'react'
import { vaspApi } from '../utils/api'
import { useApp } from '../context/AppContext'

export default function VaspRegistryPage() {
 const { showToast } = useApp()
 const [vasps, setVasps] = useState([])
 const [total, setTotal] = useState(0)
 const [stats, setStats] = useState(null)
 const [loading, setLoading] = useState(false)
 const [search, setSearch] = useState('')
 const [chain, setChain] = useState('ALL')
 const [type, setType] = useState('all')
 const [showAddModal, setShowAddModal] = useState(false)

 // Add form state
 const [newAddr, setNewAddr] = useState('')
 const [newName, setNewName] = useState('')
 const [newChain, setNewChain] = useState('ETH')
 const [newType, setNewType] = useState('exchange')
 const [newCountry, setNewCountry] = useState('India')
 const [newEmail, setNewEmail] = useState('')
 const [adding, setAdding] = useState(false)

 const fetchData = async () => {
  setLoading(true)
  try {
   const [regRes, statsRes] = await Promise.all([
    vaspApi.getRegistry({
     search,
     chain: chain === 'ALL' ? null : chain,
     vasp_type: type === 'all' ? null : type,
     limit: 100
    }),
    vaspApi.getStats()
   ])
   setVasps(regRes.vasps || [])
   setTotal(regRes.total || 0)
   setStats(statsRes)
  } catch (err) {
   console.error('Error fetching VASP registry:', err)
  } finally {
   setLoading(false)
  }
 }

 useEffect(() => {
  fetchData()
 }, [chain, type])

 const handleSearchSubmit = (e) => {
  e.preventDefault()
  fetchData()
 }

 const handleAddSubmit = async (e) => {
  e.preventDefault()
  if (!newAddr.trim() || !newName.trim()) {
   showToast('Address and VASP name are required', 'warning')
   return
  }
  setAdding(true)
  try {
   await vaspApi.addVasp({
    address: newAddr.trim(),
    vasp_name: newName.trim(),
    chain: newChain,
    vasp_type: newType,
    country: newCountry,
    compliance_email: newEmail.trim()
   })
   showToast(`VASP ${newName} added to registry!`, 'success')
   setShowAddModal(false)
   setNewAddr('')
   setNewName('')
   setNewEmail('')
   fetchData()
  } catch (err) {
   showToast(err.message || 'Failed to add VASP', 'error')
  } finally {
   setAdding(false)
  }
 }

 const copyAddress = (addr) => {
  navigator.clipboard.writeText(addr)
  showToast('Address copied to clipboard', 'info')
 }

 return (
  <div className="page-container" style={{ padding: '24px 32px' }}>
   {/* Title & Action */}
   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
    <div>
     <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
       VASP Registry & Attribution Directory
     </h1>
     <p style={{ color: 'var(--text-sub)', margin: 0, fontSize: '0.85rem' }}>
      Known Centralized Exchanges, Custodial Providers, Mixers & Relayers. Indexed for O(1) forensic resolution.
     </p>
    </div>
    <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
      Register New VASP
    </button>
   </div>

   {/* Stats Cards */}
   {stats && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
     <div className="card" style={{ padding: '16px' }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-sub)', fontWeight: 600 }}>
       Total VASPs Indexed
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--indigo-light)', marginTop: '4px' }}>
       {stats.total_vasps || total}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '4px' }}>
       Across {Object.keys(stats.by_chain || {}).length} blockchains
      </div>
     </div>

     <div className="card" style={{ padding: '16px' }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-sub)', fontWeight: 600 }}>
       Indian Reporting Entities
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--emerald)', marginTop: '4px' }}>
       {stats.by_country?.India || 16}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '4px' }}>
       FIU-IND Registered (WazirX, CoinDCX, ZebPay)
      </div>
     </div>

     <div className="card" style={{ padding: '16px' }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-sub)', fontWeight: 600 }}>
       Global Exchanges
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--amber)', marginTop: '4px' }}>
       {stats.total_vasps - (stats.by_country?.India || 16)}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '4px' }}>
       Binance, OKX, Bybit, KuCoin, Coinbase
      </div>
     </div>

     <div className="card" style={{ padding: '16px' }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-sub)', fontWeight: 600 }}>
       Mixers & Sanctioned
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--rose)', marginTop: '4px' }}>
       {stats.by_type?.mixer || 14}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '4px' }}>
       Tornado Cash, Blender, Sinbad, Lazarus
      </div>
     </div>
    </div>
   )}

   {/* Filter & Search Bar */}
   <div className="card" style={{ padding: '14px 18px', marginBottom: '20px' }}>
    <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
     <div style={{ flex: 1, minWidth: '240px' }}>
      <input
       type="text"
       placeholder="Search by VASP name (e.g. Binance, WazirX) or address..."
       value={search}
       onChange={e => setSearch(e.target.value)}
       style={{
        width: '100%', padding: '8px 12px', background: 'var(--bg)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
        color: 'var(--text)', fontSize: '0.82rem'
       }}
      />
     </div>

     <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <select
       value={chain}
       onChange={e => setChain(e.target.value)}
       style={{ padding: '8px 10px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}
      >
       <option value="ALL">All Chains</option>
       <option value="BTC">Bitcoin (BTC)</option>
       <option value="ETH">Ethereum (ETH)</option>
       <option value="TRON">Tron (TRON)</option>
       <option value="BNB">Binance Chain (BNB)</option>
       <option value="SOL">Solana (SOL)</option>
      </select>

      <select
       value={type}
       onChange={e => setType(e.target.value)}
       style={{ padding: '8px 10px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}
      >
       <option value="all">All Entity Types</option>
       <option value="exchange">Exchanges</option>
       <option value="mixer">Mixers / Tumblers</option>
       <option value="bridge">Bridges</option>
       <option value="custodial">Custodial Wallets</option>
      </select>

      <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '8px 14px' }}>
        Search
      </button>
     </div>
    </form>
   </div>

   {/* VASP Table */}
   <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
    {loading ? (
     <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>
      <span className="spinner" /> Querying VASP Registry...
     </div>
    ) : vasps.length === 0 ? (
     <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-sub)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}></div>
      <p style={{ margin: 0 }}>No VASPs match the current query.</p>
     </div>
    ) : (
     <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
       <thead>
        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-sub)' }}>
         <th style={{ padding: '12px 16px' }}>VASP Entity</th>
         <th style={{ padding: '12px 16px' }}>Chain</th>
         <th style={{ padding: '12px 16px' }}>Entity Type</th>
         <th style={{ padding: '12px 16px' }}>Country</th>
         <th style={{ padding: '12px 16px' }}>On-Chain Deposit Address</th>
         <th style={{ padding: '12px 16px' }}>Compliance Contact</th>
         <th style={{ padding: '12px 16px' }}>Source</th>
        </tr>
       </thead>
       <tbody>
        {vasps.map((v, i) => (
         <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
          <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
           {v.vasp_name}
           {v.verified ? (
            <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'var(--emerald)' }}> Verified</span>
           ) : null}
          </td>
          <td style={{ padding: '12px 16px' }}>
           <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', fontWeight: 600 }}>
            {v.chain}
           </span>
          </td>
          <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
           {v.vasp_type}
          </td>
          <td style={{ padding: '12px 16px' }}>
           {v.country || 'Global'}
          </td>
          <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
           <span title={v.address} style={{ cursor: 'pointer' }} onClick={() => copyAddress(v.address)}>
            {v.address.slice(0, 10)}...{v.address.slice(-6)} 
           </span>
          </td>
          <td style={{ padding: '12px 16px', color: 'var(--text-sub)' }}>
           {v.compliance_email || 'Desk Portal'}
          </td>
          <td style={{ padding: '12px 16px', color: 'var(--text-sub)', fontSize: '0.7rem' }}>
           {v.source || 'REGISTRY'}
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </div>

   {/* Add VASP Modal */}
   {showAddModal && (
    <div style={{
     position: 'fixed', inset: 0, zIndex: 10000,
     background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
     display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
     <div style={{
      background: 'var(--card-bg, #0f172a)',
      border: '1px solid var(--border, #334155)',
      borderRadius: '12px', width: '560px', maxWidth: '100%',
      padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
     }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
       <h3 style={{ margin: 0, fontSize: '1.1rem' }}> Add VASP to Forensic Registry</h3>
       <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', fontSize: '1.2rem', cursor: 'pointer' }}>
        
       </button>
      </div>

      <form onSubmit={handleAddSubmit}>
       <div className="field-group" style={{ marginBottom: '14px' }}>
        <label className="field-label">Deposit / Hot Wallet Address *</label>
        <input
         type="text"
         placeholder="e.g. 0x26232F4FD07b17d9d6E99CD9a0d30c3A8b095E3e"
         value={newAddr}
         onChange={e => setNewAddr(e.target.value)}
         required
         style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
        />
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div className="field-group">
         <label className="field-label">VASP Name *</label>
         <input
          type="text"
          placeholder="e.g. Mudrex, Bitget"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          required
         />
        </div>
        <div className="field-group">
         <label className="field-label">Blockchain</label>
         <select value={newChain} onChange={e => setNewChain(e.target.value)} style={{ width: '100%', padding: '9px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
          <option value="ETH">Ethereum (ETH)</option>
          <option value="BTC">Bitcoin (BTC)</option>
          <option value="TRON">Tron (TRON)</option>
          <option value="BNB">Binance Chain (BNB)</option>
          <option value="SOL">Solana (SOL)</option>
         </select>
        </div>
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div className="field-group">
         <label className="field-label">Entity Type</label>
         <select value={newType} onChange={e => setNewType(e.target.value)} style={{ width: '100%', padding: '9px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
          <option value="exchange">Exchange</option>
          <option value="custodial">Custodial Wallet</option>
          <option value="mixer">Mixer / Tumbler</option>
          <option value="bridge">Cross-Chain Bridge</option>
         </select>
        </div>
        <div className="field-group">
         <label className="field-label">Country / Jurisdiction</label>
         <input
          type="text"
          placeholder="India / Global"
          value={newCountry}
          onChange={e => setNewCountry(e.target.value)}
         />
        </div>
       </div>

       <div className="field-group" style={{ marginBottom: '20px' }}>
        <label className="field-label">Compliance / Nodal Desk Email</label>
        <input
         type="email"
         placeholder="compliance@exchange.com"
         value={newEmail}
         onChange={e => setNewEmail(e.target.value)}
        />
       </div>

       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
         Cancel
        </button>
        <button type="submit" disabled={adding} className="btn btn-primary">
         {adding ? 'Saving...' : 'Save to Registry'}
        </button>
       </div>
      </form>
     </div>
    </div>
   )}
  </div>
 )
}
