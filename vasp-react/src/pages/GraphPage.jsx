import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { DEMO_CASE, DEMO_CASE_2 } from '../data/constants'
import { downloadFirPdf } from '../utils/firReportGenerator'
import { exportPng, exportSvg } from '../utils/exportHelpers'
import SahyogNoticeModal from '../components/SahyogNoticeModal'

function formatDateTime(ts) {
 if (!ts) return 'Unknown'
 const date = new Date(ts > 1e11 ? ts : ts * 1000)
 if (isNaN(date.getTime())) return 'Unknown'
 return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(amt) {
 if (amt === undefined || amt === null) return '0.00'
 const num = Number(amt)
 if (num === 0) return '0.00'
 if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
 if (num < 0.0001) return num.toFixed(6)
 if (num < 1) return num.toFixed(4)
 return num.toFixed(4)
}

function truncateAddress(addr) {
 if (!addr) return ''
 if (addr.length <= 14) return addr
 return `${addr.slice(0, 7)}...${addr.slice(-5)}`
}

export default function GraphPage() {
 const { currentReport, setCurrentReport, setCurrentView, showToast } = useApp()

 // Layout mode: 'vertical' (Top -> Bottom Tree - LEA Standard) vs 'horizontal' (Left -> Right) vs 'cashout' (Direct 1-line to Binance)
 const [layoutDirection, setLayoutDirection] = useState('vertical')
 const [viewFilter, setViewFilter] = useState('all') // 'all' vs 'cashout'

 const [zoom, setZoom] = useState(1)
 const [pan, setPan] = useState({ x: 0, y: 0 })
 const [isPanning, setIsPanning] = useState(false)
 const [panStart, setPanStart] = useState({ x: 0, y: 0 })

 // Draggable node state
 const [nodePositions, setNodePositions] = useState({})
 const [draggingNode, setDraggingNode] = useState(null)
 const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

 // Selection & Search
 const [selectedNode, setSelectedNode] = useState(null)
 const [selectedEdge, setSelectedEdge] = useState(null)
 const [hoveredNode, setHoveredNode] = useState(null)
 const [hoveredEdge, setHoveredEdge] = useState(null)
 const [searchQuery, setSearchQuery] = useState('')

 useEffect(() => {
  const handleKeyDown = (e) => {
   if (e.key === 'Escape') {
    setSelectedNode(null)
    setSelectedEdge(null)
   }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
 }, [])

 // SAHYOG Modal Integration
 const [sahyogTarget, setSahyogTarget] = useState(null)

 const containerRef = useRef(null)
 const svgRef = useRef(null)

 // =========================================================================
 // FORENSIC TOP-TO-BOTTOM TREE GRAPH ENGINE
 // =========================================================================
 const baseGraph = useMemo(() => {
  if (!currentReport) {
   return { nodes: [], edges: [], bounds: { minX: 0, maxX: 1200, minY: 0, maxY: 800, width: 1200, height: 800 } }
  }

  const ledger = currentReport.chain_of_custody_ledger || []
  const suspect = currentReport.suspect_address || ledger[0]?.from || ''
  const vaspTargets = currentReport.vasp_targets || []
  const chainSymbol = currentReport.blockchain || 'BTC'

  const nodeMap = new Map()

  function getOrCreateNode(addr) {
   if (!addr) return null
   const clean = addr.trim()
   if (!nodeMap.has(clean)) {
    const isSuspect = clean.toLowerCase() === suspect?.toLowerCase()
    const vaspMatch = vaspTargets.find(v => v.address?.toLowerCase() === clean.toLowerCase())
    nodeMap.set(clean, {
     id: clean,
     addr: clean,
     isSuspect,
     isVasp: !!vaspMatch,
     vaspName: vaspMatch?.vasp_name || (clean.toLowerCase().includes('binance') ? 'Binance' : null),
     jurisdiction: vaspMatch?.jurisdiction || 'Global (VASP Registry)',
     complianceEmail: vaspMatch?.compliance_email || 'compliance@binance.com',
     inflow: 0,
     outflow: 0,
     inTxs: [],
     outTxs: []
    })
   }
   return nodeMap.get(clean)
  }

  if (suspect) getOrCreateNode(suspect)

  const rawEdges = []
  ledger.forEach((row, idx) => {
   if (!row.from || !row.to) return
   const fromNode = getOrCreateNode(row.from)
   const toNode = getOrCreateNode(row.to)
   if (!fromNode || !toNode) return

   const amt = Number(row.amount) || 0
   fromNode.outflow += amt
   toNode.inflow += amt

   const edgeObj = {
    id: `e-${idx}`,
    from: row.from,
    to: row.to,
    amount: amt,
    currency: chainSymbol,
    timestamp: row.timestamp,
    txHash: row.tx_hash,
    profile: row.profile,
    hop: row.hop,
    accScore: row.acc_score,
    paesScore: row.paes_score
   }

   fromNode.outTxs.push(edgeObj)
   toNode.inTxs.push(edgeObj)
   rawEdges.push(edgeObj)
  })

  let activeNodes = Array.from(nodeMap.values())
  let activeEdges = [...rawEdges]

  // If filtered to cash-out path
  if (viewFilter === 'cashout') {
   const vaspNode = activeNodes.find(n => n.isVasp)
   if (vaspNode) {
    const trailNodeIds = new Set([vaspNode.id])
    const trailEdges = []

    let curr = vaspNode.id
    while (curr && curr.toLowerCase() !== suspect.toLowerCase()) {
     const tNode = nodeMap.get(curr)
     if (!tNode || tNode.inTxs.length === 0) break
     const bestEdge = [...tNode.inTxs].sort((a, b) => b.amount - a.amount)[0]
     trailEdges.unshift(bestEdge)
     trailNodeIds.add(bestEdge.from)
     curr = bestEdge.from
    }

    if (trailEdges.length > 0) {
     activeNodes = activeNodes.filter(n => trailNodeIds.has(n.id))
     activeEdges = trailEdges
    }
   }
  }

  // 1. Strict Topological DAG Leveling (Longest path to prevent backward arrows)
  const levels = {}
  if (suspect) levels[suspect] = 0
  activeNodes.forEach(n => { if (levels[n.id] === undefined) levels[n.id] = 0 })

  for (let iter = 0; iter < 15; iter++) {
   activeEdges.forEach(e => {
    const fromLvl = levels[e.from] || 0
    if (levels[e.to] === undefined || levels[e.to] <= fromLvl) {
     levels[e.to] = fromLvl + 1
    }
   })
  }

  activeNodes.forEach(n => {
   n.level = levels[n.id] || 0
  })

  // 2. Identify 3 Distinct Horizontal Branches originating from Suspect
  const hop1Txs = activeEdges.filter(e => e.from.toLowerCase() === suspect.toLowerCase())
  const nodeBranchMap = new Map()
  nodeBranchMap.set(suspect, 1) // center

  hop1Txs.forEach((e, bIdx) => {
   nodeBranchMap.set(e.to, bIdx)
   const q = [e.to]
   while (q.length > 0) {
    const curr = q.shift()
    activeEdges.forEach(edge => {
     if (edge.from === curr && !nodeBranchMap.has(edge.to)) {
      nodeBranchMap.set(edge.to, bIdx)
      q.push(edge.to)
     }
    })
   }
  })

  activeNodes.forEach(n => {
   if (!nodeBranchMap.has(n.id)) nodeBranchMap.set(n.id, 0)
   n.branch = nodeBranchMap.get(n.id)
  })

  // 3. Compute Coordinates (VERTICAL vs HORIZONTAL)
  const CARD_W = 186
  const CARD_H = 56
  const initialPositions = {}

  if (layoutDirection === 'vertical') {
   // ==========================================
   // VERTICAL TOP-TO-BOTTOM TREE HIERARCHY
   // ==========================================
   // Row 0 = Suspect (Top Center)
   // Row 1 = Hop 1
   // Row 2 = Hop 2
   // Row 3 = Hop 3
   // Row 4 = Hop 4
   // Row 5 = Terminal VASP (Bottom)
   const ROW_HEIGHT = 165
   const BASE_Y = 60

   // Partition nodes by branch to allocate distinct horizontal X columns
   const branchNodes = { 0: [], 1: [], 2: [] }
   activeNodes.forEach(n => {
    if (n.id.toLowerCase() === suspect.toLowerCase()) return
    const b = n.branch in branchNodes ? n.branch : 0
    branchNodes[b].push(n)
   })

   // Allocate X slots: Branch 0 (Left), Branch 1 (Middle), Branch 2 (Right)
   // For each level in each branch, position nodes neatly
   const branchXCenters = {
    0: 220, // Branch 1 (Left lane)
    1: 620, // Branch 2 (Middle lane)
    2: 1080 // Branch 3 (Right lane - Binance cashout)
   }

   // Group by (branch, level)
   const branchLevels = { 0: {}, 1: {}, 2: {} }
   activeNodes.forEach(n => {
    if (n.id.toLowerCase() === suspect.toLowerCase()) return
    const b = n.branch in branchLevels ? n.branch : 0
    if (!branchLevels[b][n.level]) branchLevels[b][n.level] = []
    branchLevels[b][n.level].push(n)
   })

   // Position branch nodes
   Object.entries(branchLevels).forEach(([bStr, bLevels]) => {
    const b = Number(bStr)
    const centerX = branchXCenters[b] || 600

    Object.entries(bLevels).forEach(([lvlStr, nodesInLevel]) => {
     const lvl = Number(lvlStr)
     const count = nodesInLevel.length
     const levelY = BASE_Y + lvl * ROW_HEIGHT

     nodesInLevel.forEach((n, idx) => {
      const offset = (idx - (count - 1) / 2) * (CARD_W + 28)
      initialPositions[n.id] = {
       x: Math.round(centerX + offset - CARD_W / 2),
       y: levelY
      }
     })
    })
   })

   // Suspect sits right at the TOP CENTER anchored above all 3 branches
   initialPositions[suspect] = {
    x: Math.round(branchXCenters[1] - CARD_W / 2),
    y: BASE_Y
   }

  } else {
   // ==========================================
   // HORIZONTAL LEFT-TO-RIGHT HIERARCHY
   // ==========================================
   const COL_WIDTH = 290
   const ROW_HEIGHT = 70
   const START_X = 60
   const START_Y = 80

   const branchLevels = { 0: {}, 1: {}, 2: {} }
   activeNodes.forEach(n => {
    if (n.id.toLowerCase() === suspect.toLowerCase()) return
    const b = n.branch in branchLevels ? n.branch : 0
    if (!branchLevels[b][n.level]) branchLevels[b][n.level] = []
    branchLevels[b][n.level].push(n)
   })

   const branchYOffsets = { 0: START_Y, 1: START_Y + 220, 2: START_Y + 440 }

   initialPositions[suspect] = {
    x: START_X,
    y: START_Y + 220
   }

   Object.entries(branchLevels).forEach(([bStr, bLevels]) => {
    const b = Number(bStr)
    const baseY = branchYOffsets[b] || START_Y

    Object.entries(bLevels).forEach(([lvlStr, nodesInLevel]) => {
     const lvl = Number(lvlStr)
     nodesInLevel.forEach((n, idx) => {
      initialPositions[n.id] = {
       x: START_X + lvl * COL_WIDTH,
       y: baseY + idx * ROW_HEIGHT
      }
     })
    })
   })
  }

  const maxLvl = Math.max(...activeNodes.map(n => n.level), 1)

  return {
   nodes: activeNodes,
   edges: activeEdges,
   maxLevel: maxLvl,
   initialPositions,
   cardW: CARD_W,
   cardH: CARD_H,
   suspect
  }
 }, [currentReport, layoutDirection, viewFilter])

 // Sync node positions on baseGraph update
 useEffect(() => {
  if (baseGraph.initialPositions) {
   setNodePositions(baseGraph.initialPositions)
  }
 }, [baseGraph])

 const resetLayout = useCallback(() => {
  if (baseGraph.initialPositions) {
   setNodePositions({ ...baseGraph.initialPositions })
   setPan({ x: 0, y: 0 })
   setZoom(1)
   showToast('Graph reset to clean, non-overlapping flow layout', 'info')
  }
 }, [baseGraph, showToast])

 // =========================================================================
 // RENDERED GRAPH WITH SMOOTH DIRECTIONAL CONNECTORS
 // =========================================================================
 const renderedGraph = useMemo(() => {
  const { nodes, edges, cardW, cardH } = baseGraph
  if (!nodes.length) {
   return { nodes: [], edges: [], bounds: { minX: 0, maxX: 1200, minY: 0, maxY: 900, width: 1200, height: 900 } }
  }

  const posMap = new Map()
  nodes.forEach(n => {
   const pos = nodePositions[n.id] || baseGraph.initialPositions?.[n.id] || { x: 50, y: 50 }
   posMap.set(n.id, { ...n, x: pos.x, y: pos.y, width: cardW, height: cardH })
  })

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  posMap.forEach(n => {
   if (n.x < minX) minX = n.x
   if (n.x + n.width > maxX) maxX = n.x + n.width
   if (n.y < minY) minY = n.y
   if (n.y + n.height > maxY) maxY = n.y + n.height
  })

  if (minX === Infinity) {
   minX = 0; maxX = 1200; minY = 0; maxY = 900
  }

  const renderedNodes = Array.from(posMap.values())

  // Compute edge paths based on layout direction (Vertical: Top->Bottom, Horizontal: Left->Right)
  const isVertical = layoutDirection === 'vertical'

  const edgePairCounts = {}
  edges.forEach(e => {
   const key = `${e.from}->${e.to}`
   edgePairCounts[key] = (edgePairCounts[key] || 0) + 1
   e.pairIndex = edgePairCounts[key] - 1
  })

  const renderedEdges = edges.map(e => {
   const fromNode = posMap.get(e.from)
   const toNode = posMap.get(e.to)
   if (!fromNode || !toNode) return null

   let x1, y1, x2, y2, path, midX, midY
   const pairTotal = edgePairCounts[`${e.from}->${e.to}`] || 1
   const pairOffset = pairTotal > 1 ? (e.pairIndex - (pairTotal - 1) / 2) * 22 : 0

   if (isVertical) {
    // Exits bottom center of fromNode, enters top center of toNode
    x1 = fromNode.x + fromNode.width / 2 + pairOffset
    y1 = fromNode.y + fromNode.height
    x2 = toNode.x + toNode.width / 2 + pairOffset
    y2 = toNode.y

    const midVertical = (y1 + y2) / 2
    path = `M ${x1} ${y1} C ${x1} ${midVertical}, ${x2} ${midVertical}, ${x2} ${y2}`
    midX = (x1 + x2) / 2
    midY = midVertical
   } else {
    // Exits right center of fromNode, enters left center of toNode
    x1 = fromNode.x + fromNode.width
    y1 = fromNode.y + fromNode.height / 2 + pairOffset
    x2 = toNode.x
    y2 = toNode.y + toNode.height / 2 + pairOffset

    const midHorizontal = (x1 + x2) / 2
    path = `M ${x1} ${y1} C ${midHorizontal} ${y1}, ${midHorizontal} ${y2}, ${x2} ${y2}`
    midX = midHorizontal
    midY = (y1 + y2) / 2
   }

   return {
    ...e,
    fromNode,
    toNode,
    path,
    midX,
    midY
   }
  }).filter(Boolean)

  return {
   nodes: renderedNodes,
   edges: renderedEdges,
   bounds: { minX, maxX: maxX + 100, minY, maxY: maxY + 100, width: maxX - minX + 200, height: maxY - minY + 200 }
  }
 }, [baseGraph, nodePositions, layoutDirection])

 // Auto-fit to viewport
 const fitGraphToScreen = useCallback(() => {
  if (!containerRef.current || renderedGraph.nodes.length === 0) return

  const containerW = containerRef.current.clientWidth || 1000
  const containerH = containerRef.current.clientHeight || 600
  const { minX, minY, width, height } = renderedGraph.bounds

  const padding = 60
  const scaleX = (containerW - padding * 2) / Math.max(width, 100)
  const scaleY = (containerH - padding * 2) / Math.max(height, 100)
  const newZoom = Math.max(0.4, Math.min(scaleX, scaleY, 1.05))

  const newPanX = (containerW - width * newZoom) / 2 - minX * newZoom
  const newPanY = (containerH - height * newZoom) / 2 - minY * newZoom

  setZoom(newZoom)
  setPan({ x: newPanX, y: newPanY })
 }, [renderedGraph])

 // Mouse pan handlers
 const handleCanvasMouseDown = (e) => {
  if (e.target.closest('.graph-node-interactive') || e.target.closest('.graph-edge-interactive')) return
  setIsPanning(true)
  setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
 }

 const handleCanvasMouseMove = (e) => {
  if (draggingNode) {
   const containerRect = containerRef.current?.getBoundingClientRect()
   if (!containerRect) return

   const mouseSvgX = (e.clientX - containerRect.left - pan.x) / zoom
   const mouseSvgY = (e.clientY - containerRect.top - pan.y) / zoom

   setNodePositions(prev => ({
    ...prev,
    [draggingNode]: {
     x: Math.round(mouseSvgX - dragOffset.x),
     y: Math.round(mouseSvgY - dragOffset.y)
    }
   }))
   return
  }

  if (isPanning) {
   setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }
 }

 const handleCanvasMouseUp = () => {
  setIsPanning(false)
  setDraggingNode(null)
 }

 // Ctrl+Scroll = zoom only. Regular scroll = page scrolls (not hijacked).
 const handleWheel = useCallback((e) => {
  if (e.ctrlKey || e.metaKey) {
   e.preventDefault()
   e.stopPropagation()
   const factor = e.deltaY < 0 ? 1.1 : 0.91
   setZoom(z => Math.max(0.3, Math.min(3.0, z * factor)))
  }
  // No else: regular scroll is NOT intercepted -- browser handles page scroll
 }, [])

 // Attach as non-passive so e.preventDefault() works for Ctrl+Scroll
 useEffect(() => {
  const el = containerRef.current
  if (!el) return
  el.addEventListener('wheel', handleWheel, { passive: false })
  return () => el.removeEventListener('wheel', handleWheel)
 }, [handleWheel])

 const copyToClipboard = (text, label) => {
  navigator.clipboard.writeText(text).then(() => {
   showToast(`${label} copied to clipboard`, 'success')
  }).catch(() => {
   showToast('Failed to copy', 'error')
  })
 }

 const cleanSearch = searchQuery ? searchQuery.trim().toLowerCase() : ''
 const isDimmed = Boolean(hoveredNode || selectedNode || cleanSearch)

 const isNodeActive = (node) => {
  if (cleanSearch) {
   if (node.addr.toLowerCase().includes(cleanSearch)) return true
   if (node.vaspName && node.vaspName.toLowerCase().includes(cleanSearch)) return true
   const hasEdge = renderedGraph.edges.some(e =>
    (e.from === node.id || e.to === node.id) && e.txHash && e.txHash.toLowerCase().includes(cleanSearch)
   )
   if (hasEdge) return true
  }
  if (!hoveredNode && !selectedNode) return false
  if (hoveredNode?.id === node.id || selectedNode?.id === node.id) return true
  if (hoveredEdge) return hoveredEdge.from === node.id || hoveredEdge.to === node.id
  if (selectedEdge) return selectedEdge.from === node.id || selectedEdge.to === node.id

  const activeId = hoveredNode?.id || selectedNode?.id
  return renderedGraph.edges.some(e =>
   (e.from === activeId && e.to === node.id) ||
   (e.to === activeId && e.from === node.id)
  )
 }

 const isEdgeActive = (edge) => {
  if (cleanSearch) {
   if (edge.txHash && edge.txHash.toLowerCase().includes(cleanSearch)) return true
   if (edge.from.toLowerCase().includes(cleanSearch) || edge.to.toLowerCase().includes(cleanSearch)) return true
  }
  if (hoveredEdge?.id === edge.id || selectedEdge?.id === edge.id) return true
  const activeId = hoveredNode?.id || selectedNode?.id
  if (!activeId) return false
  return edge.from === activeId || edge.to === activeId
 }

 return (
  <div style={{ height: 'calc(100vh - var(--header-h) - 30px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
   {/* Top Header Controls Toolbar */}
   <div
    style={{
     display: 'flex',
     justifyContent: 'space-between',
     alignItems: 'center',
     flexWrap: 'wrap',
     gap: 12,
     padding: '10px 18px',
     background: '#ffffff',
     borderRadius: '16px',
     border: '1.5px solid #030441',
     boxShadow: '0 4px 16px rgba(3, 4, 65, 0.05)',
     flexShrink: 0
    }}
   >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
     <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
      Forensic Fund Flow Graph
     </span>
     {currentReport && (
      <span style={{
       fontSize: '0.68rem',
       fontWeight: 700,
       background: 'rgba(99, 102, 241, 0.15)',
       color: '#a5b4fc',
       border: '1px solid rgba(99, 102, 241, 0.3)',
       padding: '2px 8px',
       borderRadius: 'var(--r-full)'
      }}>
       Case: {currentReport.case_id || 'Active'}
      </span>
     )}
     {currentReport?.blockchain && (
      <span style={{
       fontSize: '0.68rem',
       fontWeight: 700,
       background: 'rgba(56, 189, 248, 0.12)',
       color: '#38bdf8',
       border: '1px solid rgba(56, 189, 248, 0.25)',
       padding: '2px 8px',
       borderRadius: 'var(--r-full)'
      }}>
       {currentReport.blockchain} Network
      </span>
     )}
    </div>

    {/* Orientation Switcher & Controls */}
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
     {/* DIRECTION SWITCHER */}
     <div style={{ display: 'flex', background: 'var(--bg-void)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)' }}>
      <button
       onClick={() => setLayoutDirection('vertical')}
       className={`btn btn-sm ${layoutDirection === 'vertical' ? 'btn-primary' : 'btn-ghost'}`}
       style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
       title="Vertical Tree (Top Suspect -> Bottom VASP)"
      >
       <span>↓</span>
       <span>Vertical Tree (Top → Bottom)</span>
      </button>
      <button
       onClick={() => setLayoutDirection('horizontal')}
       className={`btn btn-sm ${layoutDirection === 'horizontal' ? 'btn-primary' : 'btn-ghost'}`}
       style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
       title="Horizontal Left -> Right Flow"
      >
       <span>→</span>
       <span>Horizontal Flow</span>
      </button>
     </div>

     {/* VIEW FILTER */}
     <div style={{ display: 'flex', background: 'var(--bg-void)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--border)' }}>
      <button
       onClick={() => setViewFilter('all')}
       className={`btn btn-sm ${viewFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
       style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700 }}
      >
       All Branches
      </button>
      <button
       onClick={() => setViewFilter('cashout')}
       className={`btn btn-sm ${viewFilter === 'cashout' ? 'btn-primary' : 'btn-ghost'}`}
       style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700 }}
       title="Direct stolen fund trail into Binance"
      >
       Direct Cash-Out Trail
      </button>
     </div>

     {/* Search box for Address or TxHash */}
     <div style={{ position: 'relative' }}>
      <input
       type="text"
       className="input"
       placeholder="Find address or TxHash..."
       value={searchQuery}
       onChange={e => setSearchQuery(e.target.value)}
       style={{ padding: '5px 10px 5px 28px', fontSize: '0.72rem', width: 170 }}
      />
      <svg
       style={{ position: 'absolute', left: 8, top: 8, width: 13, height: 13, color: 'var(--text-muted)' }}
       viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
       <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      {searchQuery && (
       <button
        onClick={() => setSearchQuery('')}
        style={{ position: 'absolute', right: 8, top: 7, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
       >
        
       </button>
      )}
     </div>

     {/* Action buttons */}
     <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <button
       className="btn btn-secondary btn-sm"
       onClick={resetLayout}
       title="Auto align tree layout"
       style={{ fontSize: '0.72rem', padding: '5px 9px' }}
      >
       Auto Align
      </button>
      <button
       className="btn btn-secondary btn-sm"
       onClick={fitGraphToScreen}
       title="Fit graph to window"
       style={{ fontSize: '0.72rem', padding: '5px 9px' }}
      >
       Fit View
      </button>
      <button
       className="btn btn-ghost btn-sm"
       title="Zoom In (or Ctrl + Scroll)"
       onClick={() => setZoom(z => Math.min(z * 1.15, 2.5))}
       style={{ padding: '4px 7px' }}
      >
       +
      </button>
      <button
       className="btn btn-ghost btn-sm"
       title="Zoom Out (or Ctrl + Scroll)"
       onClick={() => setZoom(z => Math.max(z * 0.85, 0.4))}
       style={{ padding: '4px 7px' }}
      >
       −
      </button>
      <button
       className="btn btn-primary btn-sm"
       onClick={() => {
        if (currentReport) downloadFirPdf(currentReport, 'Cyber Crime Investigator')
        else showToast('Please load an investigation first to download FIR PDF', 'warn')
       }}
       style={{
        padding: '5px 12px',
        fontSize: '0.72rem',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #059669, #0284c7)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 5
       }}
      >
       <span>FIR PDF</span>
      </button>
      <button
       className="btn btn-secondary btn-sm"
       onClick={() => {
        if (svgRef.current) exportPng(svgRef.current, `FundFlow_${currentReport?.case_id || 'Graph'}.png`)
        else showToast('Graph not ready', 'warn')
       }}
       style={{ fontSize: '0.72rem', padding: '5px 8px' }}
      >
       PNG
      </button>
     </div>
    </div>
   </div>

   {/* Main Interactive Canvas */}
   <div
    className="graph-wrap"
    ref={containerRef}
    style={{
     flex: 1,
     position: 'relative',
     background: '#f8fafc',
     cursor: isPanning ? 'grabbing' : 'default',
     userSelect: 'none',
     overflow: 'hidden',
     border: '1.5px solid #030441',
     borderRadius: '16px',
     boxShadow: '0 4px 16px rgba(3, 4, 65, 0.05)'
    }}
    onMouseDown={handleCanvasMouseDown}
    onMouseMove={handleCanvasMouseMove}
    onMouseUp={handleCanvasMouseUp}
   >
    {/* LEA Forensic Watermark */}
    <div style={{
     position: 'absolute',
     top: 12,
     left: 16,
     zIndex: 5,
     pointerEvents: 'none',
     fontSize: '0.72rem',
     color: '#64748b',
     fontWeight: 700,
     display: 'flex',
     gap: 16
    }}>
     <span>Nodes: {renderedGraph.nodes.length}</span>
     <span>Transfers: {renderedGraph.edges.length}</span>
     <span>Zoom: {Math.round(zoom * 100)}%</span>
     <span style={{ color: '#38bdf8' }}>• Scroll wheel = scroll canvas vertically • Ctrl + Wheel = zoom</span>
    </div>

    {/* SVG Interactive Forensic Network */}
    {currentReport ? (
     <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
     >
      <defs>
       <pattern id="forensic-grid" width="30" height="30" patternUnits="userSpaceOnUse">
        <circle cx="15" cy="15" r="1" fill="rgba(3, 4, 65, 0.08)" />
       </pattern>

       {/* Directional arrow markers */}
       <marker id="arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
       </marker>
       <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
       </marker>
       <marker id="arrow-vasp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
       </marker>
      </defs>

      <rect width="100%" height="100%" fill="url(#forensic-grid)" />

      {/* Transform Layer for Pan & Zoom */}
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
       {/* Row Level Indicators (if Vertical) */}
       {layoutDirection === 'vertical' && Array.from({ length: baseGraph.maxLevel + 1 }).map((_, lvl) => {
        const rowY = 60 + lvl * 165 + 28
        return (
         <g key={`lvl-guide-${lvl}`}>
          <line
           x1={30}
           y1={rowY}
           x2={Math.max(renderedGraph.bounds.maxX + 80, 1400)}
           y2={rowY}
           stroke="rgba(255, 255, 255, 0.03)"
           strokeDasharray="4 4"
          />
          <text
           x={40}
           y={rowY - 6}
           fill="rgba(255, 255, 255, 0.22)"
           fontFamily="var(--font-mono)"
           fontSize="9"
           fontWeight="700"
           letterSpacing="0.8"
          >
           {lvl === 0 ? 'TOP: ORIGIN (SUSPECT WALLET)' : lvl === baseGraph.maxLevel ? 'TERMINAL: VASP (EXCHANGE CASH-OUT)' : `HOP ${lvl} INTERMEDIARIES`}
          </text>
         </g>
        )
       })}

       {/* Edges Layer */}
       <g className="edges-layer">
        {renderedGraph.edges.map(edge => {
         const active = isEdgeActive(edge)
         const dimmed = isDimmed && !active
         const isEnteringVasp = edge.toNode?.isVasp

         return (
          <g
           key={edge.id}
           className="graph-edge-interactive"
           style={{ cursor: 'pointer', opacity: dimmed ? 0.12 : 1, transition: 'opacity 0.2s' }}
           onMouseEnter={() => setHoveredEdge(edge)}
           onMouseLeave={() => setHoveredEdge(null)}
           onClick={(e) => {
            e.stopPropagation()
            setSelectedEdge(edge)
            setSelectedNode(null)
           }}
          >
           <path d={edge.path} fill="none" stroke="transparent" strokeWidth="20" />

           <path
            d={edge.path}
            fill="none"
            stroke={active ? '#38bdf8' : isEnteringVasp ? '#10b981' : '#475569'}
            strokeWidth={active ? 2.5 : 1.5}
            strokeDasharray={active ? '5 3' : 'none'}
            markerEnd={`url(#${active ? 'arrow-active' : isEnteringVasp ? 'arrow-vasp' : 'arrow-default'})`}
           />

           {/* Amount pill */}
           <g transform={`translate(${edge.midX}, ${edge.midY})`}>
            <rect
             x="-42"
             y="-10"
             width="84"
             height="20"
             rx="4"
             fill="#ffffff"
             stroke={active ? '#0284c7' : isEnteringVasp ? '#059669' : '#cbd5e1'}
             strokeWidth={active ? 2 : 1.5}
            />
            <text
             x="0"
             y="3.5"
             textAnchor="middle"
             fill={active ? '#0284c7' : isEnteringVasp ? '#059669' : '#030441'}
             fontFamily="var(--font-mono)"
             fontSize="9"
             fontWeight="800"
            >
             {formatAmount(edge.amount)} {edge.currency}
            </text>
           </g>
          </g>
         )
        })}
       </g>

       {/* Nodes Layer */}
       <g className="nodes-layer">
        {renderedGraph.nodes.map(node => {
         const active = isNodeActive(node)
         const isSelected = selectedNode?.id === node.id
         const isHighlightedSearch = cleanSearch && (
          node.addr.toLowerCase().includes(cleanSearch) ||
          (node.vaspName && node.vaspName.toLowerCase().includes(cleanSearch))
         )
         const dimmed = isDimmed && !active && !isHighlightedSearch

         const borderColor = node.isSuspect ? '#dc2626' : node.isVasp ? '#059669' : (isSelected ? '#0284c7' : '#030441')
         const headerBg = node.isSuspect ? '#fee2e2' : node.isVasp ? '#d1fae5' : '#f1f5f9'
         const cardBg = '#ffffff'
         const titleColor = node.isSuspect ? '#991b1b' : node.isVasp ? '#065f46' : '#030441'

         return (
          <g
           key={node.id}
           transform={`translate(${node.x}, ${node.y})`}
           className="graph-node-interactive"
           style={{ cursor: draggingNode === node.id ? 'grabbing' : 'grab', opacity: dimmed ? 0.2 : 1, transition: 'opacity 0.2s' }}
           onMouseEnter={() => setHoveredNode(node)}
           onMouseLeave={() => setHoveredNode(null)}
           onMouseDown={(e) => {
            e.stopPropagation()
            const containerRect = containerRef.current?.getBoundingClientRect()
            if (!containerRect) return
            const mouseSvgX = (e.clientX - containerRect.left - pan.x) / zoom
            const mouseSvgY = (e.clientY - containerRect.top - pan.y) / zoom
            setDraggingNode(node.id)
            setDragOffset({ x: mouseSvgX - node.x, y: mouseSvgY - node.y })
           }}
           onClick={(e) => {
            e.stopPropagation()
            setSelectedNode(node)
            setSelectedEdge(null)
           }}
          >
           {/* Body Card */}
           <rect
            width={node.width}
            height={node.height}
            rx="6"
            fill={cardBg}
            stroke={isHighlightedSearch ? '#fbbf24' : isSelected ? '#38bdf8' : borderColor}
            strokeWidth={isHighlightedSearch ? 2.5 : isSelected ? 2 : (node.isSuspect || node.isVasp ? 1.8 : 1.2)}
           />

           {/* Header Strip */}
           <rect
            x="1"
            y="1"
            width={node.width - 2}
            height="18"
            rx="5"
            fill={headerBg}
           />

           {/* Header Dot Indicator */}
           <circle
            cx="12"
            cy="10"
            r="3.2"
            fill={node.isSuspect ? '#ef4444' : node.isVasp ? '#10b981' : '#64748b'}
           />

           {/* Role Label */}
           <text
            x="20"
            y="13"
            fill={titleColor}
            fontFamily="var(--font-sans)"
            fontSize="8.5"
            fontWeight="800"
            letterSpacing="0.4"
           >
            {node.isSuspect
             ? 'SUSPECT (ORIGIN)'
             : node.isVasp
             ? (node.vaspName ? `${node.vaspName.toUpperCase()} (VASP)` : 'VERIFIED VASP')
             : `HOP ${node.level} INTERMEDIARY`}
           </text>

           {/* Address in clean Monospace font */}
           <text
            x="11"
            y="38"
            fill="#030441"
            fontFamily="var(--font-mono)"
            fontSize="9.5"
            fontWeight="700"
           >
            {truncateAddress(node.addr)}
           </text>

           {/* Copy Address Button */}
           <g
            transform={`translate(${node.width - 24}, 28)`}
            onClick={(e) => {
             e.stopPropagation()
             copyToClipboard(node.addr, 'Address')
            }}
            style={{ cursor: 'pointer' }}
            title="Copy Address"
           >
            <rect x="-2" y="-2" width="16" height="16" rx="3" fill="rgba(255,255,255,0.06)" />
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
           </g>
          </g>
         )
        })}
       </g>
      </g>
     </svg>
    ) : (
     <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>No Graph Data Loaded</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 14 }}>
       Load a forensic case or run a multi-hop trace to inspect fund flows.
      </p>
      <button
       className="btn btn-primary btn-sm"
       onClick={() => {
        setCurrentReport(DEMO_CASE)
        showToast('Loaded 5-Hop BTC Investigation Case', 'success')
       }}
      >
       Load 5-Hop BTC Case (bc1q9wnz...)
      </button>
     </div>
    )}

    {/* Inspector Side Drawer */}
    {(selectedNode || selectedEdge) && (
     <div style={{
      position: 'absolute',
      top: 14,
      right: 14,
      width: 340,
      maxHeight: 'calc(100% - 28px)',
      background: '#ffffff',
      border: '1.5px solid #030441',
      borderRadius: '16px',
      boxShadow: '0 8px 30px rgba(3, 4, 65, 0.15)',
      padding: 20,
      zIndex: 25,
      overflowY: 'auto',
      color: '#030441'
     }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
       <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
        {selectedNode ? 'Wallet Forensic Details' : 'Transaction Details'}
       </div>
       <button
        className="btn btn-ghost btn-sm"
        onClick={() => { setSelectedNode(null); setSelectedEdge(null) }}
        title="Close details (Esc)"
        style={{
         width: 28,
         height: 28,
         minWidth: 28,
         padding: 0,
         borderRadius: 'var(--r-sm)',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         color: '#cbd5e1',
         cursor: 'pointer',
         border: '1px solid rgba(255, 255, 255, 0.15)',
         background: 'rgba(255, 255, 255, 0.08)',
         transition: 'all 0.15s ease'
        }}
        onMouseEnter={e => {
         e.currentTarget.style.color = '#ffffff'
         e.currentTarget.style.background = 'rgba(239, 68, 68, 0.28)'
         e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)'
        }}
        onMouseLeave={e => {
         e.currentTarget.style.color = '#cbd5e1'
         e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
         e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
        }}
       >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
         <line x1="18" y1="6" x2="6" y2="18"></line>
         <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
       </button>
      </div>

      {selectedNode && (
       <div>
        <div style={{ marginBottom: 12 }}>
         <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.5px' }}>
          Wallet Address
         </div>
         <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          background: 'var(--bg-void)',
          padding: '8px 10px',
          borderRadius: 'var(--r-md)',
          wordBreak: 'break-all',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8
         }}>
          <span style={{ color: '#f1f5f9' }}>{selectedNode.addr}</span>
          <button
           className="btn btn-ghost btn-sm"
           onClick={() => copyToClipboard(selectedNode.addr, 'Address')}
           style={{ padding: '2px 6px', flexShrink: 0 }}
           title="Copy Address"
          >
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
           </svg>
          </button>
         </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
         <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>HOP LEVEL</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: selectedNode.isSuspect ? '#ef4444' : selectedNode.isVasp ? '#10b981' : '#818cf8', marginTop: 2 }}>
           {selectedNode.isSuspect ? 'Hop 0 (Origin)' : `Hop ${selectedNode.level}`}
          </div>
         </div>
         <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>ROLE</div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedNode.isVasp ? '#10b981' : 'var(--text-primary)', marginTop: 2 }}>
           {selectedNode.isVasp ? (selectedNode.vaspName || 'Binance VASP') : selectedNode.isSuspect ? 'Primary Suspect' : 'Unhosted'}
          </div>
         </div>
        </div>

        {/* VASP SAHYOG Portal Notice Dispatch Action */}
        {selectedNode.isVasp && (
         <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: 12, borderRadius: 'var(--r-md)', marginBottom: 12 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
           <span></span>
           <span>ACTIONABLE VASP GATEWAY (SAHYOG PORTAL)</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
           <strong>Exchange:</strong> {selectedNode.vaspName || 'Binance'}<br />
           <strong>Jurisdiction:</strong> {selectedNode.jurisdiction}<br />
           <strong>Compliance Desk:</strong> {selectedNode.complianceEmail}<br />
           <strong>Statutory Section:</strong> Section 91 CrPC / Section 94 BNSS
          </div>
          <button
           className="btn btn-primary btn-sm w-full"
           style={{
            background: 'linear-gradient(135deg, #059669, #0284c7)',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.74rem',
            width: '100%',
            justifyContent: 'center',
            gap: 6
           }}
           onClick={() => setSahyogTarget({
            vasp_name: selectedNode.vaspName || 'Binance',
            address: selectedNode.addr,
            compliance_email: selectedNode.complianceEmail,
            jurisdiction: selectedNode.jurisdiction
           })}
          >
           <span></span>
           <span>Generate SAHYOG Statutory Notice</span>
          </button>
         </div>
        )}

        <div style={{ marginBottom: 12 }}>
         <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Flow Accounting
         </div>
         <div style={{ fontSize: '0.74rem', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Total Inflow:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#34d399' }}>
           +{formatAmount(selectedNode.inflow)} {currentReport.blockchain || 'BTC'}
          </span>
         </div>
         <div style={{ fontSize: '0.74rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Total Outflow:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f87171' }}>
           -{formatAmount(selectedNode.outflow)} {currentReport.blockchain || 'BTC'}
          </span>
         </div>
        </div>

        <button
         className="btn btn-secondary btn-sm w-full"
         style={{ width: '100%', marginTop: 4 }}
         onClick={() => {
          setCurrentView('trace')
          showToast(`Tracing wallet ${selectedNode.addr.slice(0, 10)}...`, 'info')
         }}
        >
         Forward Trace This Address
        </button>
       </div>
      )}

      {selectedEdge && (
       <div>
        <div style={{ marginBottom: 10 }}>
         <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Transferred Amount
         </div>
         <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {formatAmount(selectedEdge.amount)} {selectedEdge.currency}
         </div>
        </div>

        <div style={{ marginBottom: 10 }}>
         <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp</div>
         <div style={{ fontSize: '0.76rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {formatDateTime(selectedEdge.timestamp)}
         </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
         <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>ACC SCORE</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>
           {Math.round((selectedEdge.accScore || 0.7) * 100)}%
          </div>
         </div>
         <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>PAES SCORE</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399' }}>
           {Math.round((selectedEdge.paesScore || 0.8) * 100)}%
          </div>
         </div>
        </div>

        <div style={{ marginBottom: 8 }}>
         <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2 }}>SENDER (HOP {selectedEdge.fromNode?.level})</div>
         <div
          onClick={() => setSelectedNode(selectedEdge.fromNode)}
          style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-void)', padding: '6px 8px', borderRadius: 'var(--r-sm)', wordBreak: 'break-all', cursor: 'pointer', border: '1px solid var(--border-subtle)' }}
          title="Click to inspect sender wallet"
         >
          {selectedEdge.from}
         </div>
        </div>

        <div style={{ marginBottom: 8 }}>
         <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2 }}>RECEIVER (HOP {selectedEdge.toNode?.level})</div>
         <div
          onClick={() => setSelectedNode(selectedEdge.toNode)}
          style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-void)', padding: '6px 8px', borderRadius: 'var(--r-sm)', wordBreak: 'break-all', cursor: 'pointer', border: '1px solid var(--border-subtle)' }}
          title="Click to inspect receiver wallet"
         >
          {selectedEdge.to}
         </div>
        </div>

        {selectedEdge.txHash && (
         <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2 }}>TRANSACTION HASH</div>
          <div style={{
           fontSize: '0.66rem',
           fontFamily: 'var(--font-mono)',
           background: 'var(--bg-void)',
           padding: '6px 8px',
           borderRadius: 'var(--r-sm)',
           wordBreak: 'break-all',
           display: 'flex',
           justifyContent: 'space-between',
           alignItems: 'center',
           gap: 6,
           border: '1px solid var(--border-subtle)'
          }}>
           <span style={{ color: '#cbd5e1' }}>{selectedEdge.txHash}</span>
           <button
            className="btn btn-ghost btn-sm"
            onClick={() => copyToClipboard(selectedEdge.txHash, 'Tx Hash')}
            style={{ padding: '2px 5px', flexShrink: 0 }}
            title="Copy Tx Hash"
           >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
           </button>
          </div>
         </div>
        )}

        <div style={{ background: 'var(--bg-void)', padding: 8, borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
         <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>AML CLASSIFICATION</div>
         <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', marginTop: 2 }}>
          {selectedEdge.profile || 'Layering / Intermediary Transfer'}
         </div>
        </div>
       </div>
      )}
     </div>
    )}

    {/* Legend bar at bottom */}
    <div
     className="graph-legend"
     style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ffffff',
      zIndex: 5,
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      borderTop: '1.5px solid #030441',
      color: '#030441',
      boxShadow: '0 -2px 10px rgba(3, 4, 65, 0.05)'
     }}
    >
     <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
       <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#dc2626' }} />
       <span style={{ color: '#030441' }}>TOP: Primary Suspect (Origin)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
       <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#64748b' }} />
       <span style={{ color: '#030441' }}>MIDDLE: Unhosted Intermediary (Layering)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
       <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#059669' }} />
       <span style={{ color: '#030441' }}>BOTTOM: Verified VASP / Binance (Cash-Out)</span>
      </div>
     </div>
     <div style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
      Natural Top-to-Bottom Flow • Scroll wheel to explore downstream
     </div>
    </div>
   </div>

   {/* SAHYOG Statutory Notice Modal Integration */}
   {sahyogTarget && (
    <SahyogNoticeModal
     vaspTarget={sahyogTarget}
     report={currentReport}
     onClose={() => setSahyogTarget(null)}
    />
   )}
  </div>
 )
}
