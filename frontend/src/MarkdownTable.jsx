import { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

const OPERATION_TYPES = [
  { code: 'S', label: 'Subtract' },
  { code: 'A', label: 'Add' },
  { code: 'M', label: 'Multiply' },
  { code: 'D', label: 'Divide' },
  { code: 'O', label: 'Override' }
]

const DTE_COLORS = {
  'D0': { bg: '#E8F5E9', header: '#A5D6A7' },
  'D1': { bg: '#E3F2FD', header: '#90CAF9' },
  'D2': { bg: '#FFF3E0', header: '#FFCC80' },
  'D3': { bg: '#F3E5F5', header: '#CE93D8' },
  'D4': { bg: '#FFEBEE', header: '#EF9A9A' },
  'D5': { bg: '#E0F7FA', header: '#80DEEA' },
  'D6': { bg: '#FFF8E1', header: '#FFE082' },
  'D7': { bg: '#F1F8E9', header: '#C5E1A5' },
}

const getColumnColor = (colName, isHeader = false) => {
  const match = colName.match(/^(D\d+)_/)
  if (match) {
    const dGroup = match[1]
    const colors = DTE_COLORS[dGroup] || { bg: '#F5F5F5', header: '#E0E0E0' }
    return isHeader ? colors.header : colors.bg
  }
  return null
}

const isDColumn = (colName) => /^D\d+_/.test(colName)

const hasNonZeroDValues = (row) => {
  return Object.keys(row).some(col => {
    if (isDColumn(col)) {
      const val = row[col]
      return val !== null && val !== undefined && parseFloat(val) !== 0
    }
    return false
  })
}

const FROZEN_COLUMN_COUNT = 5
const FROZEN_COL_WIDTHS = [115, 180, 180, 180, 120]
const TOTAL_FROZEN_WIDTH = FROZEN_COL_WIDTHS.reduce((a, b) => a + b, 0)
const SCROLLABLE_COL_WIDTH = 130
const ACTION_COL_WIDTH = 160
const OPERATION_COL_WIDTH = 140
const VALUE_COL_WIDTH = 120

const COLUMN_DISPLAY_NAMES = {
  'HierarchyLevel4Name': ['Hierarchy', 'Level 4'],
  'HierarchyLevel3Name': ['Hierarchy', 'Level 3'],
  'HierarchyLevel2Name': ['Hierarchy', 'Level 2'],
  'HierarchyLevel1Name': ['Hierarchy', 'Level 1'],
  'PPGClusterID': ['PPG', 'ClusterID'],
  'ConfigOperationType': ['Configuration', 'Type'],
}

const renderHeader = (colName) => {
  const dMatch = colName.match(/^D(\d+)_H(\d+)_M(\d+)$/)
  if (dMatch) {
    return (<>Days to Expiry: {dMatch[1]}<br />Hours to Sell: {dMatch[2]}<br />Minimum Qty: {dMatch[3]}</>)
  }
  const displayName = COLUMN_DISPLAY_NAMES[colName]
  if (displayName && Array.isArray(displayName)) return <>{displayName[0]}<br />{displayName[1]}</>
  return colName
}

const SortIndicator = ({ column, sortColumn, sortDirection }) => {
  if (sortColumn !== column) return null
  return <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>{sortDirection === 'asc' ? '^' : 'v'}</span>
}

const opLabel = (code) => {
  const op = OPERATION_TYPES.find(o => o.code === code)
  return op ? op.label : (code || '—')
}

// =============================================================================
// Conflict Resolution Modal
// =============================================================================
function ConflictModal({ isOpen, conflicts, onResolve }) {
  const [choices, setChoices] = useState({})

  useEffect(() => {
    if (isOpen && conflicts.length > 0) {
      const initial = {}
      conflicts.forEach(r => { initial[r.PPGClusterID] = null })
      setChoices(initial)
    }
  }, [isOpen, conflicts])

  if (!isOpen || !conflicts || conflicts.length === 0) return null

  const setAll = (choice) => {
    const updated = {}
    conflicts.forEach(r => { updated[r.PPGClusterID] = choice })
    setChoices(updated)
  }

  const setOne = (ppgId, choice) => {
    setChoices(prev => ({ ...prev, [ppgId]: choice }))
  }

  const sessionCount = Object.values(choices).filter(v => v === 'session').length
  const databaseCount = Object.values(choices).filter(v => v === 'database').length
  const undecidedCount = Object.values(choices).filter(v => v === null).length
  const allDecided = undecidedCount === 0

  const thBase = {
    padding: '5px 6px', color: 'white', fontWeight: '600',
    fontSize: '11px', whiteSpace: 'nowrap', textAlign: 'center',
    position: 'sticky', top: 0, zIndex: 1
  }

  // max-height is ignored on <td> — use height + overflow on an inner div instead
  const tdBase = {
    padding: '0px',
    fontSize: '11px',
    textAlign: 'center',
    borderBottom: '1px solid #dee2e6',
  }

  // Inner div inside each td enforces 2-line max
  const tdInner = {
    padding: '3px 6px',
    lineHeight: '1.35',
    height: '32px',       // exactly 2 lines of 11px text at 1.35 line-height ≈ 30px + padding
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const btnRow = {
    padding: '3px 9px', border: 'none', borderRadius: '3px',
    cursor: 'pointer', fontSize: '11px', fontWeight: '500',
    whiteSpace: 'nowrap'
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
    }}>
      <div style={{
        background: 'white', borderRadius: '8px', padding: '20px',
        width: '97vw', maxWidth: '1400px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
      }}>

        {/* Header */}
        <h2 style={{ marginTop: 0, marginBottom: '4px', color: '#333', fontSize: '18px' }}>
          ⚠️ Session Conflicts Detected
        </h2>
        <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '13px' }}>
          {conflicts.length} PPG Cluster(s) have differences between your saved session and the database.
          Choose which values to use for each row, then click Confirm.
          {undecidedCount > 0 && <span style={{ color: '#dc3545', fontWeight: '600' }}> ({undecidedCount} undecided)</span>}
        </p>

        {/* Apply to All — inline row, buttons sized to content */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px', background: '#f8f9fa', borderRadius: '6px',
          marginBottom: '10px', overflow: 'hidden'
        }}>
          <span style={{ fontWeight: '600', fontSize: '12px', color: '#333', whiteSpace: 'nowrap', flexShrink: 0 }}>Apply to All:</span>
          <button onClick={() => setAll('session')}
            style={{ padding: '6px 14px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', flex: '0 0 auto', width: '200px' }}>
            Use Previous Session Data
          </button>
          <button onClick={() => setAll('database')}
            style={{ padding: '6px 14px', background: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', flex: '0 0 auto', width: '200px' }}>
            Use Database Data
          </button>
          <button onClick={() => {
            const reset = {}
            conflicts.forEach(r => { reset[r.PPGClusterID] = null })
            setChoices(reset)
          }}
            style={{ padding: '6px 14px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', flex: '0 0 auto', width: '200px' }}>
            Clear Selections
          </button>
          <span style={{ fontSize: '11px', color: '#555', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
            {sessionCount} Session &nbsp;|&nbsp; {databaseCount} Database &nbsp;|&nbsp;
            <span style={{ color: undecidedCount > 0 ? '#dc3545' : '#198754', fontWeight: undecidedCount > 0 ? '600' : 'normal' }}>
              {undecidedCount} Undecided
            </span>
          </span>
        </div>

        {/* Conflict table — explicit height for scrollbar to work */}
        <div style={{
          overflowY: 'auto',
          overflowX: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginBottom: '12px',
          height: 'calc(90vh - 230px)',
          minHeight: '200px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '52px' }} />
              <col style={{ width: '108px' }} />
              <col style={{ width: '108px' }} />
              <col style={{ width: '108px' }} />
              <col style={{ width: '108px' }} />
              <col style={{ width: '155px' }} />
              <col style={{ width: '62px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '62px' }} />
              <col style={{ width: '95px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '165px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...thBase, background: '#495057', borderRight: '1px solid #6c757d' }}>PPG ID</th>
                <th style={{ ...thBase, background: '#495057' }}>Level 4</th>
                <th style={{ ...thBase, background: '#495057' }}>Level 3</th>
                <th style={{ ...thBase, background: '#495057' }}>Level 2</th>
                <th style={{ ...thBase, background: '#495057', borderRight: '2px solid #adb5bd' }}>Level 1</th>
                <th style={{ ...thBase, background: '#495057', borderRight: '2px solid #adb5bd' }}>Conflict Reason</th>
                <th style={{ ...thBase, background: '#0d6efd' }}>Sess. Action</th>
                <th style={{ ...thBase, background: '#0d6efd' }}>Sess. Op</th>
                <th style={{ ...thBase, background: '#0d6efd' }}>Sess. Value</th>
                <th style={{ ...thBase, background: '#0d6efd', borderRight: '2px solid #adb5bd' }}>Saved</th>
                <th style={{ ...thBase, background: '#198754' }}>DB Action</th>
                <th style={{ ...thBase, background: '#198754' }}>DB Op</th>
                <th style={{ ...thBase, background: '#198754', borderRight: '2px solid #adb5bd' }}>DB Value</th>
                <th style={{ ...thBase, background: '#6c757d' }}>Use</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((row, idx) => {
                const choice = choices[row.PPGClusterID]
                const isSession = choice === 'session'
                const isDatabase = choice === 'database'
                const isUndecided = choice === null
                const dbAction = row.DB_DerivedAction || '—'

                return (
                  <tr key={row.PPGClusterID} style={{ background: isUndecided ? (idx % 2 === 0 ? '#fffff8' : '#fffef0') : (idx % 2 === 0 ? '#fff' : '#f8f9fa') }}>
                    <td style={{ ...tdBase, borderRight: '1px solid #dee2e6' }}><div style={{ ...tdInner, fontWeight: '600', justifyContent: 'center' }}>{row.PPGClusterID}</div></td>
                    <td style={{ ...tdBase }}><div style={{ ...tdInner, justifyContent: 'center' }} title={row.HierarchyLevel4Name}>{row.HierarchyLevel4Name || '—'}</div></td>
                    <td style={{ ...tdBase }}><div style={{ ...tdInner, justifyContent: 'center' }} title={row.HierarchyLevel3Name}>{row.HierarchyLevel3Name || '—'}</div></td>
                    <td style={{ ...tdBase }}><div style={{ ...tdInner, justifyContent: 'center' }} title={row.HierarchyLevel2Name}>{row.HierarchyLevel2Name || '—'}</div></td>
                    <td style={{ ...tdBase, borderRight: '2px solid #dee2e6' }}><div style={{ ...tdInner, justifyContent: 'center' }} title={row.HierarchyLevel1Name}>{row.HierarchyLevel1Name || '—'}</div></td>

                    {/* Conflict reason — 2 lines max */}
                    <td style={{ ...tdBase, background: idx % 2 === 0 ? '#fff8e1' : '#fef9e3', borderRight: '2px solid #dee2e6' }}>
                      <div style={{ ...tdInner, justifyContent: 'center', alignItems: 'flex-start', color: '#856404', whiteSpace: 'normal', lineHeight: '1.3', paddingTop: '4px' }} title={row.ConflictReason}>
                        {row.ConflictReason}
                      </div>
                    </td>

                    {/* Session columns */}
                    <td style={{ ...tdBase, background: isSession ? '#cfe2ff' : '#eef3ff' }}><div style={tdInner}>{row.TS_Action || '—'}</div></td>
                    <td style={{ ...tdBase, background: isSession ? '#cfe2ff' : '#eef3ff' }}><div style={tdInner}>{opLabel(row.TS_OperationType)}</div></td>
                    <td style={{ ...tdBase, background: isSession ? '#cfe2ff' : '#eef3ff' }}><div style={tdInner}>{row.TS_ConfigValue !== null && row.TS_ConfigValue !== undefined ? row.TS_ConfigValue : '—'}</div></td>
                    <td style={{ ...tdBase, background: isSession ? '#cfe2ff' : '#eef3ff', borderRight: '2px solid #dee2e6' }}>
                      <div style={{ ...tdInner, flexDirection: 'column', fontSize: '10px', color: '#555', gap: '1px', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                        <span>{row.TS_SavedOnUTC || '—'}</span>
                        {row.TS_SavedBy && <span style={{ color: '#888' }}>{row.TS_SavedBy}</span>}
                      </div>
                    </td>

                    {/* DB columns */}
                    <td style={{ ...tdBase, background: isDatabase ? '#d1e7dd' : '#edf7f1' }}><div style={tdInner}>{dbAction}</div></td>
                    <td style={{ ...tdBase, background: isDatabase ? '#d1e7dd' : '#edf7f1' }}><div style={tdInner}>{opLabel(row.DB_OperationType)}</div></td>
                    <td style={{ ...tdBase, background: isDatabase ? '#d1e7dd' : '#edf7f1', borderRight: '2px solid #dee2e6' }}>
                      <div style={tdInner}>{row.DB_ConfigValue !== null && row.DB_ConfigValue !== undefined ? row.DB_ConfigValue : '—'}</div>
                    </td>

                    {/* Per-row choice buttons */}
                    <td style={{ ...tdBase, background: isUndecided ? '#fff8e1' : 'inherit' }}>
                      <div style={{ ...tdInner, gap: '4px' }}>
                        <button onClick={() => setOne(row.PPGClusterID, 'session')}
                          style={{ ...btnRow, background: isSession ? '#0d6efd' : '#e9ecef', color: isSession ? 'white' : '#495057' }}>
                          Session
                        </button>
                        <button onClick={() => setOne(row.PPGClusterID, 'database')}
                          style={{ ...btnRow, background: isDatabase ? '#198754' : '#e9ecef', color: isDatabase ? 'white' : '#495057' }}>
                          Database
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {sessionCount} using Session &nbsp;|&nbsp; {databaseCount} using Database
            {undecidedCount > 0 && <span style={{ color: '#dc3545', fontWeight: '600' }}> &nbsp;|&nbsp; {undecidedCount} still undecided</span>}
          </span>
          <button
            onClick={() => allDecided && onResolve(choices)}
            disabled={!allDecided}
            style={{
              padding: '6px 14px',
              width: '200px',
              marginRight: '15px',
              background: allDecided ? '#4C7EFF' : '#ccc',
              color: 'white', border: 'none', borderRadius: '4px',
              cursor: allDecided ? 'pointer' : 'not-allowed',
              fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap'
            }}>
            {allDecided ? 'Confirm' : `Confirm (${undecidedCount} undecided)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MarkdownTable
// =============================================================================
const MarkdownTable = forwardRef(function MarkdownTable({ data, loading, error, maxConfigVersion, activeConfigVersion }, ref) {
  const [filterHierarchy4, setFilterHierarchy4] = useState('')
  const [filterHierarchy3, setFilterHierarchy3] = useState('')
  const [filterHierarchy2, setFilterHierarchy2] = useState('')
  const [filterHierarchy1, setFilterHierarchy1] = useState('')
  const [filterPPGCluster, setFilterPPGCluster] = useState('')
  const [rowDecisions, setRowDecisions] = useState({})
  const [rowTuningConfigs, setRowTuningConfigs] = useState({})
  const [hideLeaveRows, setHideLeaveRows] = useState(false)
  const [hideChangeRows, setHideChangeRows] = useState(false)
  const [showOnlyChangeRows, setShowOnlyChangeRows] = useState(false)
  const [hideResetRows, setHideResetRows] = useState(false)
  const [showOnlyResetRows, setShowOnlyResetRows] = useState(false)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  const [sessionSaving, setSessionSaving] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionResetting, setSessionResetting] = useState(false)
  const [sessionMessage, setSessionMessage] = useState(null)

  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState([])
  const [pendingCleanRows, setPendingCleanRows] = useState([])

  const autoLoadedRef = useRef(false)
  const headerScrollRef = useRef(null)
  const bodyScrollRef = useRef(null)
  const frozenBodyRef = useRef(null)

  const handleScrollableBodyScroll = useCallback((e) => {
    if (frozenBodyRef.current) frozenBodyRef.current.scrollTop = e.target.scrollTop
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.target.scrollLeft
  }, [])

  const handleFrozenBodyScroll = useCallback((e) => {
    if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = e.target.scrollTop
  }, [])

  const handleSort = useCallback((column) => {
    if (sortColumn === column) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(column); setSortDirection(isDColumn(column) ? 'desc' : 'asc') }
  }, [sortColumn])

  const applyRows = useCallback((rows) => {
    const newDecisions = {}
    const newConfigs = {}
    rows.forEach(row => {
      newDecisions[row.PPGClusterID] = row.Action
      if (row.Action === 'Change') {
        newConfigs[row.PPGClusterID] = {
          operationType: row.OperationType || 'S',
          configValue: row.ConfigValue !== null && row.ConfigValue !== undefined ? String(row.ConfigValue) : ''
        }
      }
    })
    setRowDecisions(newDecisions)
    setRowTuningConfigs(newConfigs)
  }, [])

  const handleConflictResolve = useCallback((choices) => {
    setConflictModalOpen(false)
    const conflictRows = pendingConflicts.map(row => {
      const choice = choices[row.PPGClusterID]
      if (choice === 'session') {
        return { PPGClusterID: row.PPGClusterID, Action: row.TS_Action, OperationType: row.TS_OperationType, ConfigValue: row.TS_ConfigValue }
      } else {
        if (row.DB_DerivedAction === 'Change') {
          return { PPGClusterID: row.PPGClusterID, Action: 'Change', OperationType: row.DB_OperationType, ConfigValue: row.DB_ConfigValue }
        } else if (row.DB_DerivedAction === 'Reset') {
          return { PPGClusterID: row.PPGClusterID, Action: 'Reset', OperationType: null, ConfigValue: null }
        } else {
          return { PPGClusterID: row.PPGClusterID, Action: 'Leave', OperationType: null, ConfigValue: null }
        }
      }
    })
    const allRows = [...pendingCleanRows, ...conflictRows]
    applyRows(allRows)
    const changeCount = allRows.filter(r => r.Action === 'Change').length
    const resetCount = allRows.filter(r => r.Action === 'Reset').length
    const leaveCount = allRows.filter(r => r.Action === 'Leave').length
    setSessionMessage({ type: 'success', text: `Loaded ${allRows.length} rows (${changeCount} Change, ${resetCount} Reset, ${leaveCount} Leave).` })
    setPendingConflicts([])
    setPendingCleanRows([])
  }, [pendingConflicts, pendingCleanRows, applyRows])

  const fetchAndApply = useCallback(async (maxVersionID, activeVersionID, silent = false) => {
    if (!maxVersionID || !activeVersionID) return
    if (maxVersionID === activeVersionID) return
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tuning-session/conflicts/${maxVersionID}/${activeVersionID}`)
      if (!response.data.success) {
        if (!silent) setSessionMessage({ type: 'error', text: response.data.error || 'Failed to load proposed changes.' })
        return
      }
      const conflicts = response.data.conflicts || []
      const cleanRows = response.data.clean || []
      if (conflicts.length === 0 && cleanRows.length === 0) {
        if (!silent) setSessionMessage({ type: 'error', text: `No proposed changes found between Version ${activeVersionID} (active) and Version ${maxVersionID} (max).` })
        return
      }
      if (conflicts.length > 0) {
        setPendingConflicts(conflicts)
        setPendingCleanRows(cleanRows)
        setConflictModalOpen(true)
      } else {
        applyRows(cleanRows)
        if (!silent) {
          const changeCount = cleanRows.filter(r => r.Action === 'Change').length
          const resetCount = cleanRows.filter(r => r.Action === 'Reset').length
          const leaveCount = cleanRows.filter(r => r.Action === 'Leave').length
          setSessionMessage({ type: 'success', text: `Loaded proposed changes for Version ${maxVersionID}: ${changeCount} Change, ${resetCount} Reset, ${leaveCount} Leave.` })
        }
      }
    } catch (err) {
      if (!silent) setSessionMessage({ type: 'error', text: err.response?.data?.detail || err.message })
    }
  }, [applyRows])

  useEffect(() => {
    if (autoLoadedRef.current) return
    if (!data || data.length === 0) return
    const maxVersionID = maxConfigVersion?.[0]?.VersionID
    const activeVersionID = activeConfigVersion?.[0]?.VersionID
    if (!maxVersionID || !activeVersionID) return
    if (maxVersionID === activeVersionID) return
    autoLoadedRef.current = true
    fetchAndApply(maxVersionID, activeVersionID, true)
  }, [data, maxConfigVersion, activeConfigVersion, fetchAndApply])

  const handleLoadSession = useCallback(async () => {
    const maxVersionID = maxConfigVersion?.[0]?.VersionID
    const activeVersionID = activeConfigVersion?.[0]?.VersionID
    if (maxVersionID && activeVersionID && maxVersionID === activeVersionID) { alert('Max Version is Active Version. There are no proposed changes to load.'); return }
    if (!maxVersionID || !activeVersionID) { setSessionMessage({ type: 'error', text: 'Cannot load: Version information is not available.' }); return }
    const hasExistingDecisions = Object.keys(rowDecisions).length > 0
    if (hasExistingDecisions) {
      const confirmed = window.confirm('You have unsaved decisions in your current session. Loading proposed changes will replace them. Continue?')
      if (!confirmed) return
    }
    setSessionLoading(true); setSessionMessage(null)
    await fetchAndApply(maxVersionID, activeVersionID, false)
    setSessionLoading(false)
  }, [maxConfigVersion, activeConfigVersion, rowDecisions, fetchAndApply])

  const handleSaveSession = useCallback(async () => {
    if (!data) return
    const maxVersionID = maxConfigVersion?.[0]?.VersionID
    if (!maxVersionID) { setSessionMessage({ type: 'error', text: 'Cannot save: Max Version ID is not available.' }); return }
    const rows = data
      .filter(row => rowDecisions[row.PPGClusterID])
      .map(row => {
        const decision = rowDecisions[row.PPGClusterID]
        const tuningConfig = rowTuningConfigs[row.PPGClusterID] || {}
        return {
          PPGClusterID: row.PPGClusterID, Action: decision,
          OperationType: decision === 'Change' ? (tuningConfig.operationType || null) : null,
          ConfigValue: decision === 'Change' && tuningConfig.configValue !== '' ? parseFloat(tuningConfig.configValue) : null,
          Comment: null
        }
      })
    if (rows.length === 0) { setSessionMessage({ type: 'error', text: 'No decisions to save.' }); return }
    setSessionSaving(true); setSessionMessage(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/tuning-session/save`, { VersionID: maxVersionID, Rows: rows })
      if (response.data.success) setSessionMessage({ type: 'success', text: `Session saved! ${response.data.saved} row(s) saved for Version ${maxVersionID}.` })
      else setSessionMessage({ type: 'error', text: response.data.error || 'Failed to save session.' })
    } catch (err) { setSessionMessage({ type: 'error', text: err.response?.data?.detail || err.message }) }
    finally { setSessionSaving(false) }
  }, [data, rowDecisions, rowTuningConfigs, maxConfigVersion])

  const handleResetAll = useCallback(async () => {
    const maxVersionID = maxConfigVersion?.[0]?.VersionID
    const activeVersionID = activeConfigVersion?.[0]?.VersionID
    if (!maxVersionID || !activeVersionID) { setSessionMessage({ type: 'error', text: 'Cannot reset: Version information is not available.' }); return }
    if (maxVersionID === activeVersionID) { alert('Max Version is Active Version. There are no planned changes to reset.'); return }
    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently reset ALL planned changes for Version ${maxVersionID}.\n\n` +
      `This will:\n• Make Version ${maxVersionID}'s config match the Active Version (${activeVersionID})\n` +
      `• Delete all saved session data for Version ${maxVersionID}\n\nThis cannot be undone. Are you sure?`
    )
    if (!confirmed) return
    setSessionResetting(true); setSessionMessage(null)
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/tuning-session/reset-all/${maxVersionID}/${activeVersionID}`)
      if (response.data.success) {
        setRowDecisions({}); setRowTuningConfigs({})
        setSessionMessage({ type: 'success', text: `All planned changes for Version ${maxVersionID} have been reset to match Version ${activeVersionID}.` })
      } else { setSessionMessage({ type: 'error', text: response.data.error || 'Failed to reset planned changes.' }) }
    } catch (err) { setSessionMessage({ type: 'error', text: err.response?.data?.detail || err.message }) }
    finally { setSessionResetting(false) }
  }, [maxConfigVersion, activeConfigVersion])

  const uniqueValues = useMemo(() => {
    if (!data || data.length === 0) return {}
    return {
      hierarchy4: [...new Set(data.map(r => r.HierarchyLevel4Name).filter(Boolean))].sort(),
      hierarchy3: [...new Set(data.map(r => r.HierarchyLevel3Name).filter(Boolean))].sort(),
      hierarchy2: [...new Set(data.map(r => r.HierarchyLevel2Name).filter(Boolean))].sort(),
      hierarchy1: [...new Set(data.map(r => r.HierarchyLevel1Name).filter(Boolean))].sort(),
    }
  }, [data])

  const filteredData = useMemo(() => {
    if (!data) return []
    return data.filter(row => {
      if (filterHierarchy4 && row.HierarchyLevel4Name !== filterHierarchy4) return false
      if (filterHierarchy3 && row.HierarchyLevel3Name !== filterHierarchy3) return false
      if (filterHierarchy2 && row.HierarchyLevel2Name !== filterHierarchy2) return false
      if (filterHierarchy1 && row.HierarchyLevel1Name !== filterHierarchy1) return false
      if (filterPPGCluster && !String(row.PPGClusterID).includes(filterPPGCluster)) return false
      if (hideLeaveRows && rowDecisions[row.PPGClusterID] === 'Leave') return false
      if (hideChangeRows && rowDecisions[row.PPGClusterID] === 'Change') return false
      if (showOnlyChangeRows && rowDecisions[row.PPGClusterID] !== 'Change') return false
      if (hideResetRows && rowDecisions[row.PPGClusterID] === 'Reset') return false
      if (showOnlyResetRows && rowDecisions[row.PPGClusterID] !== 'Reset') return false
      return true
    })
  }, [data, filterHierarchy4, filterHierarchy3, filterHierarchy2, filterHierarchy1, filterPPGCluster, hideLeaveRows, hideChangeRows, showOnlyChangeRows, hideResetRows, showOnlyResetRows, rowDecisions])

  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortColumn]; let bVal = b[sortColumn]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === 'asc' ? -1 : 1
      if (bVal == null) return sortDirection === 'asc' ? 1 : -1
      if (isDColumn(sortColumn) || typeof aVal === 'number') {
        aVal = typeof aVal === 'number' ? aVal : parseFloat(aVal) || 0
        bVal = typeof bVal === 'number' ? bVal : parseFloat(bVal) || 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      aVal = String(aVal).toLowerCase(); bVal = String(bVal).toLowerCase()
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortColumn, sortDirection])

  const handleDecisionChange = useCallback((ppgClusterId, decision) => {
    setRowDecisions(prev => ({ ...prev, [ppgClusterId]: decision }))
    if (decision === 'Change') {
      setRowTuningConfigs(prev => {
        if (!prev[ppgClusterId]) return { ...prev, [ppgClusterId]: { operationType: 'S', configValue: '' } }
        return prev
      })
    }
  }, [])

  const handleTuningConfigChange = useCallback((ppgClusterId, field, value) => {
    setRowTuningConfigs(prev => ({ ...prev, [ppgClusterId]: { ...prev[ppgClusterId], [field]: value } }))
  }, [])

  const resetDecisions = useCallback(async () => {
    const maxVersionID = maxConfigVersion?.[0]?.VersionID
    const activeVersionID = activeConfigVersion?.[0]?.VersionID
    if (!maxVersionID || !activeVersionID || maxVersionID === activeVersionID) {
      setRowDecisions({})
      setRowTuningConfigs({})
      return
    }
    setSessionMessage(null)
    await fetchAndApply(maxVersionID, activeVersionID, false)
  }, [maxConfigVersion, activeConfigVersion, fetchAndApply])

  const getChangeDecisions = useCallback(() => {
    if (!data) return []
    return data
      .filter(row => rowDecisions[row.PPGClusterID] === 'Change' || rowDecisions[row.PPGClusterID] === 'Reset')
      .map(row => {
        const tuningConfig = rowTuningConfigs[row.PPGClusterID] || {}
        return {
          PPGClusterID: row.PPGClusterID,
          HierarchyLevel4Name: row.HierarchyLevel4Name,
          HierarchyLevel3Name: row.HierarchyLevel3Name,
          HierarchyLevel2Name: row.HierarchyLevel2Name,
          HierarchyLevel1Name: row.HierarchyLevel1Name,
          decision: rowDecisions[row.PPGClusterID],
          operationType: tuningConfig.operationType || 'S',
          configValue: tuningConfig.configValue || ''
        }
      })
  }, [data, rowDecisions, rowTuningConfigs])

  useImperativeHandle(ref, () => ({
    resetDecisions, getChangeDecisions, handleLoadSession, handleSaveSession, handleResetAll,
    sessionSaving, sessionLoading, sessionResetting, sessionMessage,
    clearSessionMessage: () => setSessionMessage(null)
  }), [resetDecisions, getChangeDecisions, handleLoadSession, handleSaveSession, handleResetAll, sessionSaving, sessionLoading, sessionResetting, sessionMessage])

  const decisionCounts = useMemo(() => {
    const counts = { leave: 0, change: 0, reset: 0, undecided: 0 }
    if (!data) return counts
    data.forEach(row => {
      const decision = rowDecisions[row.PPGClusterID]
      if (decision === 'Leave') counts.leave++
      else if (decision === 'Change') counts.change++
      else if (decision === 'Reset') counts.reset++
      else counts.undecided++
    })
    return counts
  }, [data, rowDecisions])

  const columns = useMemo(() => { if (!data || data.length === 0) return []; return Object.keys(data[0]) }, [data])

  const { regularColumns, dColumns } = useMemo(() => {
    const regular = columns.filter(c => !isDColumn(c))
    const dCols = columns.filter(c => isDColumn(c))
    return { regularColumns: regular, dColumns: dCols }
  }, [columns])

  const frozenColumns = regularColumns.slice(0, FROZEN_COLUMN_COUNT)
  const scrollableRegularColumns = regularColumns.slice(FROZEN_COLUMN_COUNT)
  const allScrollableColumns = [...scrollableRegularColumns, ...dColumns]
  const scrollableTableWidth = allScrollableColumns.length * SCROLLABLE_COL_WIDTH + ACTION_COL_WIDTH + OPERATION_COL_WIDTH + VALUE_COL_WIDTH

  const clearFilters = () => { setFilterHierarchy4(''); setFilterHierarchy3(''); setFilterHierarchy2(''); setFilterHierarchy1(''); setFilterPPGCluster('') }
  const clearSort = () => { setSortColumn(null); setSortDirection('asc') }

  if (loading) return <div className="loading">Loading markdown data...</div>
  if (error) return <div className="error-message">{error}</div>
  if (!data || data.length === 0) return <div className="loading">No markdown data available.</div>

  const cellStyle = { padding: '6px 10px', borderBottom: '1px solid #e0e0e0', textAlign: 'center', fontSize: '12px', whiteSpace: 'nowrap', width: SCROLLABLE_COL_WIDTH, minWidth: SCROLLABLE_COL_WIDTH, maxWidth: SCROLLABLE_COL_WIDTH, boxSizing: 'border-box', overflow: 'hidden' }
  const headerCellStyle = { padding: '6px 10px', borderBottom: '2px solid #3a5ecc', fontSize: '12px', whiteSpace: 'normal', textAlign: 'center', verticalAlign: 'middle', background: '#4C7EFF', color: 'white', fontWeight: 'bold', width: SCROLLABLE_COL_WIDTH, minWidth: SCROLLABLE_COL_WIDTH, maxWidth: SCROLLABLE_COL_WIDTH, boxSizing: 'border-box', lineHeight: '1.3', cursor: 'pointer', userSelect: 'none' }
  const actionCellStyle = { padding: '6px 6px 4px 25px', borderBottom: '1px solid #e0e0e0', textAlign: 'center', fontSize: '12px', whiteSpace: 'nowrap', width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH, maxWidth: ACTION_COL_WIDTH, boxSizing: 'border-box', overflow: 'hidden', position: 'relative' }
  const actionHeaderStyle = { padding: '6px 5px 6px 20px', borderBottom: '2px solid #3a5ecc', whiteSpace: 'normal', textAlign: 'center', verticalAlign: 'middle', background: '#4C7EFF', color: 'white', fontWeight: 'bold', width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH, maxWidth: ACTION_COL_WIDTH, boxSizing: 'border-box', lineHeight: '1.3' }
  const hasChangeRows = decisionCounts.change > 0
  const tuningHeaderStyle = { padding: '6px 10px 6px 0px', borderBottom: '2px solid #3a5ecc', fontSize: '12px', whiteSpace: 'normal', textAlign: 'center', verticalAlign: 'middle', background: hasChangeRows ? '#28a745' : '#4C7EFF', color: 'white', fontWeight: 'bold', boxSizing: 'border-box', lineHeight: '1.3' }
  const tuningCellStyle = { padding: '4px 6px', borderBottom: '1px solid #e0e0e0', textAlign: 'center', fontSize: '12px', whiteSpace: 'nowrap', boxSizing: 'border-box' }

  return (
    <div className="markdown-table-container">

      <ConflictModal isOpen={conflictModalOpen} conflicts={pendingConflicts} onResolve={handleConflictResolve} />

      {/* Filter Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
        {[
          { label: 'Hierarchy Level 4', value: filterHierarchy4, setter: setFilterHierarchy4, options: uniqueValues.hierarchy4 },
          { label: 'Hierarchy Level 3', value: filterHierarchy3, setter: setFilterHierarchy3, options: uniqueValues.hierarchy3 },
          { label: 'Hierarchy Level 2', value: filterHierarchy2, setter: setFilterHierarchy2, options: uniqueValues.hierarchy2 },
          { label: 'Hierarchy Level 1', value: filterHierarchy1, setter: setFilterHierarchy1, options: uniqueValues.hierarchy1 },
        ].map(({ label, value, setter, options }) => (
          <div key={label} style={{ minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>{label}</label>
            <select value={value} onChange={(e) => setter(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
              <option value="">All</option>
              {options?.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}
        <div style={{ width: '80px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>PPG Cluster ID</label>
          <input type="text" value={filterPPGCluster} onChange={(e) => setFilterPPGCluster(e.target.value)} placeholder="Search..."
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={clearFilters} style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Clear Filters</button>
        </div>
        {[
          { id: 'hideLeaveRows', state: hideLeaveRows, setter: setHideLeaveRows, label: 'Hide "Leave" rows', bg: '#d4edda' },
          { id: 'hideChangeRows', state: hideChangeRows, setter: setHideChangeRows, label: 'Hide "Change" rows', bg: '#f8d7da' },
          { id: 'showOnlyChangeRows', state: showOnlyChangeRows, setter: setShowOnlyChangeRows, label: 'Show Only "Change" rows', bg: '#fff3cd' },
          { id: 'hideResetRows', state: hideResetRows, setter: setHideResetRows, label: 'Hide "Reset" rows', bg: '#e2e3e5' },
          { id: 'showOnlyResetRows', state: showOnlyResetRows, setter: setShowOnlyResetRows, label: 'Show Only "Reset" rows', bg: '#e2e3e5' },
        ].map(({ id, state, setter, label, bg }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: state ? bg : '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
            <input type="checkbox" id={id} checked={state} onChange={(e) => setter(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <label htmlFor={id} style={{ fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>{label}</label>
          </div>
        ))}
      </div>

      {sessionMessage && (
        <div style={{ padding: '10px 14px', borderRadius: '4px', marginBottom: '12px', fontSize: '13px', background: sessionMessage.type === 'success' ? '#d4edda' : '#f8d7da', color: sessionMessage.type === 'success' ? '#155724' : '#721c24' }}>
          {sessionMessage.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', fontSize: '13px' }}>
        <span style={{ color: '#28a745' }}>✓ Leave: <strong>{decisionCounts.leave}</strong></span>
        <span style={{ color: '#dc3545' }}>⚠ Change: <strong>{decisionCounts.change}</strong></span>
        <span style={{ color: '#6c757d' }}>↺ Reset: <strong>{decisionCounts.reset}</strong></span>
        <span style={{ color: '#6c757d' }}>○ Undecided: <strong>{decisionCounts.undecided}</strong></span>
        {sortColumn && (
          <span style={{ marginLeft: 'auto', color: '#666' }}>
            Sorted by: <strong>{sortColumn}</strong> ({sortDirection === 'asc' ? '↑ ascending' : '↓ descending'})
            <button onClick={clearSort} style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Clear Sort</button>
          </span>
        )}
      </div>

      <p style={{ marginBottom: '12px', color: '#666' }}>Showing <strong>{sortedData.length}</strong> of <strong>{data.length}</strong> rows</p>

      <div style={{ display: 'grid', gridTemplateColumns: `${TOTAL_FROZEN_WIDTH}px 1fr`, gridTemplateRows: 'auto 1fr', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden', maxHeight: '420px' }}>
        <div style={{ background: '#4C7EFF', borderRight: '2px solid #3a5ecc', borderBottom: '2px solid #3a5ecc', overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: TOTAL_FROZEN_WIDTH }}>
            <thead><tr>
              {frozenColumns.map((col, idx) => (
                <th key={col} onClick={() => handleSort(col)} style={{ ...headerCellStyle, width: FROZEN_COL_WIDTHS[idx], minWidth: FROZEN_COL_WIDTHS[idx], maxWidth: FROZEN_COL_WIDTHS[idx], background: sortColumn === col ? '#3a5ecc' : '#4C7EFF' }}>
                  {renderHeader(col)}<SortIndicator column={col} sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
              ))}
            </tr></thead>
          </table>
        </div>
        <div ref={headerScrollRef} style={{ overflowX: 'hidden', overflowY: 'hidden', background: '#4C7EFF', borderBottom: '2px solid #3a5ecc' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: scrollableTableWidth }}>
            <thead><tr>
              {allScrollableColumns.map((col) => {
                const bgColor = getColumnColor(col, true) || '#4C7EFF'
                const textColor = getColumnColor(col, true) ? '#333' : 'white'
                const isActive = sortColumn === col
                return (
                  <th key={col} onClick={() => handleSort(col)} style={{ ...headerCellStyle, background: isActive ? (getColumnColor(col, true) ? '#888' : '#3a5ecc') : bgColor, color: textColor }}>
                    {renderHeader(col)}<SortIndicator column={col} sortColumn={sortColumn} sortDirection={sortDirection} />
                  </th>
                )
              })}
              <th style={actionHeaderStyle}>Action</th>
              <th style={{ ...tuningHeaderStyle, width: OPERATION_COL_WIDTH, minWidth: OPERATION_COL_WIDTH, maxWidth: OPERATION_COL_WIDTH }}>Operation</th>
              <th style={{ ...tuningHeaderStyle, width: VALUE_COL_WIDTH, minWidth: VALUE_COL_WIDTH, maxWidth: VALUE_COL_WIDTH }}>Value</th>
            </tr></thead>
          </table>
        </div>
        <div ref={frozenBodyRef} onScroll={handleFrozenBodyScroll} style={{ overflowY: 'auto', overflowX: 'hidden', borderRight: '2px solid #ccc', maxHeight: '380px' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: TOTAL_FROZEN_WIDTH }}>
            <tbody>
              {sortedData.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  {frozenColumns.map((col, colIdx) => (
                    <td key={col} style={{ ...cellStyle, width: FROZEN_COL_WIDTHS[colIdx], minWidth: FROZEN_COL_WIDTHS[colIdx], maxWidth: FROZEN_COL_WIDTHS[colIdx], background: 'inherit' }}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : 'NULL'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={bodyScrollRef} onScroll={handleScrollableBodyScroll} style={{ overflow: 'auto', maxHeight: '380px' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: scrollableTableWidth }}>
            <tbody>
              {sortedData.map((row, rowIdx) => {
                const ppgId = row.PPGClusterID
                const currentDecision = rowDecisions[ppgId] || null
                const tuningConfig = rowTuningConfigs[ppgId] || { operationType: 'S', configValue: '' }
                const isChangeSelected = currentDecision === 'Change'
                return (
                  <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                    {allScrollableColumns.map((col) => {
                      const bgColor = getColumnColor(col, false)
                      const value = row[col]
                      const displayValue = value !== null && value !== undefined
                        ? ((isDColumn(col) || col === 'DTE1_Scalar') ? Math.round(typeof value === 'number' ? value : parseFloat(value)) : String(value))
                        : 'NULL'
                      return <td key={col} style={{ ...cellStyle, background: bgColor || 'inherit' }}>{displayValue}</td>
                    })}
                    <td style={{ ...actionCellStyle, background: currentDecision === 'Leave' ? '#d4edda' : currentDecision === 'Change' ? '#fff3cd' : currentDecision === 'Reset' ? '#f8d7da' : 'inherit' }}>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
                        {['Leave', 'Change', 'Reset'].map(action => {
                          const isDisabled = action === 'Reset' && !hasNonZeroDValues(row)
                          const isActive = currentDecision === action
                          const activeColors = { Leave: '#28a745', Change: '#dc3545', Reset: '#6c757d' }
                          return (
                            <button key={action} onClick={() => handleDecisionChange(ppgId, isActive ? null : action)} disabled={isDisabled}
                              style={{ padding: '2px 6px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: isDisabled ? 'not-allowed' : 'pointer', background: isActive ? activeColors[action] : (isDisabled ? '#f5f5f5' : '#e9ecef'), color: isActive ? 'white' : (isDisabled ? '#adb5bd' : '#495057'), fontWeight: isActive ? 'bold' : 'normal' }}>
                              {action}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ ...tuningCellStyle, width: OPERATION_COL_WIDTH, minWidth: OPERATION_COL_WIDTH, maxWidth: OPERATION_COL_WIDTH, paddingLeft: '25px', background: isChangeSelected ? '#d4edda' : 'inherit' }}>
                      <select value={tuningConfig.operationType} onChange={(e) => handleTuningConfigChange(ppgId, 'operationType', e.target.value)} disabled={!isChangeSelected}
                        style={{ width: '100%', padding: '2px 4px', fontSize: '11px', borderRadius: '3px', border: '1px solid #ddd', background: isChangeSelected ? 'white' : '#f5f5f5', color: isChangeSelected ? '#333' : '#999', cursor: isChangeSelected ? 'pointer' : 'not-allowed' }}>
                        {OPERATION_TYPES.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
                      </select>
                    </td>
                    <td style={{ ...tuningCellStyle, width: VALUE_COL_WIDTH, minWidth: VALUE_COL_WIDTH, maxWidth: VALUE_COL_WIDTH, paddingLeft: '25px', background: isChangeSelected ? '#d4edda' : 'inherit' }}>
                      <input type="number" step="0.01" value={tuningConfig.configValue} onChange={(e) => handleTuningConfigChange(ppgId, 'configValue', e.target.value)} disabled={!isChangeSelected} placeholder="0.00"
                        style={{ width: '100%', padding: '2px 4px', fontSize: '11px', borderRadius: '3px', border: '1px solid #ddd', textAlign: 'center', background: isChangeSelected ? 'white' : '#f5f5f5', color: isChangeSelected ? '#333' : '#999', cursor: isChangeSelected ? 'text' : 'not-allowed', boxSizing: 'border-box' }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})

export default MarkdownTable
