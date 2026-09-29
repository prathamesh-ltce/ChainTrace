import { useState, useEffect } from 'react'
import { batchApi } from '../utils/api'
import { useApp } from '../context/AppContext'

export default function BatchPage() {
 const { showToast, setCurrentReport, setCurrentView } = useApp()
 const [addressInput, setAddressInput] = useState('')
 const [blockchain, setBlockchain] = useState('Auto')
 const [maxHops, setMaxHops] = useState(10)
 const [submitting, setSubmitting] = useState(false)
 const [batches, setBatches] = useState([])
 const [loadingBatches, setLoadingBatches] = useState(false)

 const fetchBatches = async () => {
  setLoadingBatches(true)
  try {
   const res = await batchApi.getBatches()
   setBatches(res.batches || [])
  } catch (err) {
   console.error('Error fetching batches:', err)
  } finally {
   setLoadingBatches(false)
  }
 }

 useEffect(() => {
  fetchBatches()
  const interval = setInterval(fetchBatches, 10000)
  return () => clearInterval(interval)
 }, [])

 const handleSubmit = async (e) => {
  e.preventDefault()
  const lines = addressInput
   .split('\n')
   .map(l => l.trim())
   .filter(l => l.length > 0)

  if (lines.length === 0) {
   showToast('Please enter at least one wallet address.', 'warning')
   return
  }

  setSubmitting(true)
  try {
   const res = await batchApi.submitBatch(lines, blockchain, maxHops)
   showToast(res.message || 'Batch submitted successfully!', 'success')
   setAddressInput('')
   fetchBatches()
  } catch (err) {
   showToast(err.message || 'Failed to submit batch', 'error')
  } finally {
   setSubmitting(false)
  }
 }

 const handleFileUpload = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
   const text = evt.target?.result || ''
   setAddressInput(text)
   showToast(`Loaded ${file.name}`, 'info')
  }
  reader.readAsText(file)
 }

 return (
  <div className="page-container" style={{ padding: '24px 32px' }}>
   {/* Page Title */}
   <div style={{ marginBottom: '24px' }}>
    <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
      Batch Multi-Wallet Tracing Queue
    </h1>
    <p style={{ color: 'var(--text-sub)', margin: 0, fontSize: '0.85rem' }}>
     Queue multiple suspect addresses simultaneously. Multi-threaded background forensic ingestion with FIFO processing.
    </p>
   </div>

   <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }}>
    {/* Left: Input Form */}
    <div className="card" style={{ padding: '20px' }}>
     <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
       Submit Batch Investigation
     </h3>

     <form onSubmit={handleSubmit}>
      <div className="field-group" style={{ marginBottom: '14px' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label className="field-label" style={{ margin: 0 }}>Suspect Wallet Addresses (One per line)</label>
        <label style={{ fontSize: '0.72rem', color: 'var(--indigo-light)', cursor: 'pointer' }}>
          Upload CSV / TXT
         <input type="file" accept=".txt,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
       </div>
       <textarea
        rows={7}
        placeholder="bc1q9wnz3hjqt4mms7ed7ap57zhcv5psmt63kg8gfh&#10;0x6582b7C80dF319553a988F62436b8A1be6b2B24C&#10;1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s"
        value={addressInput}
        onChange={e => setAddressInput(e.target.value)}
        style={{
         width: '100%', padding: '10px', background: 'var(--bg)',
         border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
         fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text)',
         resize: 'vertical'
        }}
       />
       <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '4px' }}>
        Count: {addressInput.split('\n').filter(l => l.trim()).length} address(es) detected
       </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
       <div className="field-group">
        <label className="field-label">Chain Detection</label>
        <select
         value={blockchain}
         onChange={e => setBlockchain(e.target.value)}
         style={{
          width: '100%', padding: '8px 10px', background: 'var(--bg)',
          color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)'
         }}
        >
         <option value="Auto">Auto-Detect per Address</option>
         <option value="BTC">Bitcoin (BTC)</option>
         <option value="ETH">Ethereum (ETH)</option>
         <option value="TRON">Tron (TRX/USDT)</option>
         <option value="SOL">Solana (SOL)</option>
        </select>
       </div>

       <div className="field-group">
        <label className="field-label">Max Traversal Hops: {maxHops}</label>
        <input
         type="range"
         min="2"
         max="20"
         value={maxHops}
         onChange={e => setMaxHops(Number(e.target.value))}
         style={{ width: '100%', accentColor: 'var(--indigo)' }}
        />
       </div>
      </div>

      <button
       type="submit"
       disabled={submitting}
       className="btn btn-primary w-full"
       style={{ justifyContent: 'center' }}
      >
       {submitting ? 'Queuing Batch...' : ' Queue Batch Investigation'}
      </button>
     </form>
    </div>

    {/* Right: Active Batches Table */}
    <div className="card" style={{ padding: '20px' }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
      <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        Batch Execution Queue
      </h3>
      <button onClick={fetchBatches} className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem' }}>
        Refresh
      </button>
     </div>

     {loadingBatches && batches.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-sub)' }}>
       <span className="spinner" /> Loading batch queue...
      </div>
     ) : batches.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-sub)' }}>
       <div style={{ fontSize: '2rem', marginBottom: '8px' }}></div>
       <p style={{ margin: 0 }}>No batch traces in queue.</p>
       <span style={{ fontSize: '0.72rem' }}>Submit multiple suspect wallets on the left to start multi-case tracing.</span>
      </div>
     ) : (
      <div style={{ overflowX: 'auto' }}>
       <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
         <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-sub)' }}>
          <th style={{ padding: '8px' }}>Batch ID</th>
          <th style={{ padding: '8px' }}>Status</th>
          <th style={{ padding: '8px' }}>Progress</th>
          <th style={{ padding: '8px' }}>Created</th>
          <th style={{ padding: '8px' }}>Submitted By</th>
         </tr>
        </thead>
        <tbody>
         {batches.map(b => (
          <tr key={b.batch_id} style={{ borderBottom: '1px solid var(--border)' }}>
           <td style={{ padding: '10px 8px', fontWeight: 600, fontFamily: 'monospace' }}>
            {b.batch_id}
           </td>
           <td style={{ padding: '10px 8px' }}>
            <span style={{
             padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold',
             background: b.status === 'complete' ? 'hsla(152,76%,40%,0.15)' : 'hsla(217,91%,60%,0.15)',
             color: b.status === 'complete' ? 'var(--emerald)' : 'var(--indigo-light)'
            }}>
             {b.status.toUpperCase()}
            </span>
           </td>
           <td style={{ padding: '10px 8px' }}>
            {b.completed_count} / {b.total_count} Wallets
           </td>
           <td style={{ padding: '10px 8px', color: 'var(--text-sub)' }}>
            {b.created_at ? new Date(b.created_at).toLocaleTimeString() : 'N/A'}
           </td>
           <td style={{ padding: '10px 8px', color: 'var(--text-sub)' }}>
            {b.created_by || 'Officer'}
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     )}
    </div>
   </div>
  </div>
 )
}
