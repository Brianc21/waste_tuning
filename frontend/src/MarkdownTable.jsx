import { useState, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'

/**
 * MarkdownTable Component
 * 
 * Displays the Current Default Markdowns with:
 * - Color-coded columns for D0, D1, D2, etc. groupings
 * - Dropdown filters for hierarchy levels
 * - Text search for PPGClusterID
 * - First 5 columns frozen (Excel-style freeze panes)
 * - Header row always visible
 * - Action column for tuning decisions (Leave/Change)
 * - Operation and Value columns for tuning config (enabled when Change selected)
 * - Sortable columns (click header to sort)
 */

// Operation type mapping
const OPERATION_TYPES = [
  { code: 'S', label: 'Subtract' },
  { code: 'A', label: 'Add' },
  { code: 'M', label: 'Multiply' },
  { code: 'D', label: 'Divide' },
  { code: 'O', label: 'Override' }
]

// Color palette for DaysToExpiry groupings
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

// Check if a row has any non-zero D column values (has existing config)
const hasNonZeroDValues = (row) => {
  return Object.keys(row).some(col => {
    if (isDColumn(col)) {
      const val = row[col]
      return val !== null && val !== undefined && parseFloat(val) !== 0
    }
    return false
  })
}

// Frozen column configuration
const FROZEN_COLUMN_COUNT = 5
const FROZEN_COL_WIDTHS = [115, 180, 180, 180, 120]
const TOTAL_FROZEN_WIDTH = FROZEN_COL_WIDTHS.reduce((a, b) => a + b, 0)
const SCROLLABLE_COL_WIDTH = 130
const ACTION_COL_WIDTH = 160
const OPERATION_COL_WIDTH = 140
const VALUE_COL_WIDTH = 120

// Display names for column headers (arrays create line breaks)
const COLUMN_DISPLAY_NAMES = {
  'HierarchyLevel4Name': ['Hierarchy', 'Level 4'],
  'HierarchyLevel3Name': ['Hierarchy', 'Level 3'],
  'HierarchyLevel2Name': ['Hierarchy', 'Level 2'],
  'HierarchyLevel1Name': ['Hierarchy', 'Level 1'],
  'PPGClusterID': ['PPG', 'ClusterID'],
  'ConfigOperationType': ['Configuration', 'Type'],
}

// Render column header with optional line breaks
const renderHeader = (colName) => {
  const dMatch = colName.match(/^D(\d+)_H(\d+)_M(\d+)$/)
  if (dMatch) {
    const daysToExpiry = dMatch[1]
    const hoursToSell = dMatch[2]
    const minQty = dMatch[3]
    return (
      <>
        Days to Expiry: {daysToExpiry}<br />
        Hours to Sell: {hoursToSell}<br />
        Minimum Qty: {minQty}
      </>
    )
  }
  
  const displayName = COLUMN_DISPLAY_NAMES[colName]
  if (displayName && Array.isArray(displayName)) {
    return (
      <>
        {displayName[0]}<br />{displayName[1]}
      </>
    )
  }
  return colName
}

// Sort indicator component
const SortIndicator = ({ column, sortColumn, sortDirection }) => {
  if (sortColumn !== column) {
    return null
  }
  return (
    <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>
      {sortDirection === 'asc' ? '^' : 'v'}
    </span>
  )
}

const MarkdownTable = forwardRef(function MarkdownTable({ data, loading, error }, ref) {
  const [filterHierarchy4, setFilterHierarchy4] = useState('')
  const [filterHierarchy3, setFilterHierarchy3] = useState('')
  const [filterHierarchy2, setFilterHierarchy2] = useState('')
  const [filterHierarchy1, setFilterHierarchy1] = useState('')
  const [filterPPGCluster, setFilterPPGCluster] = useState('')
  
  // Tuning decision state: { PPGClusterID: 'Leave' | 'Change' }
  const [rowDecisions, setRowDecisions] = useState({})
  
  // Tuning config state: { PPGClusterID: { operationType: 'S', configValue: '' } }
  const [rowTuningConfigs, setRowTuningConfigs] = useState({})
  
  const [hideLeaveRows, setHideLeaveRows] = useState(false)
  const [hideChangeRows, setHideChangeRows] = useState(false)
  const [showOnlyChangeRows, setShowOnlyChangeRows] = useState(false)
  const [hideResetRows, setHideResetRows] = useState(false)
  const [showOnlyResetRows, setShowOnlyResetRows] = useState(false)
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Refs for scroll syncing
  const headerScrollRef = useRef(null)
  const bodyScrollRef = useRef(null)
  const frozenBodyRef = useRef(null)

  // Sync vertical scroll between frozen and scrollable body
  const handleScrollableBodyScroll = useCallback((e) => {
    if (frozenBodyRef.current) {
      frozenBodyRef.current.scrollTop = e.target.scrollTop
    }
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.target.scrollLeft
    }
  }, [])

  const handleFrozenBodyScroll = useCallback((e) => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = e.target.scrollTop
    }
  }, [])

  // Handle column sort
  const handleSort = useCallback((column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection(isDColumn(column) ? 'desc' : 'asc')
    }
  }, [sortColumn])

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

  // Sort the filtered data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData
    
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortColumn]
      let bVal = b[sortColumn]
      
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === 'asc' ? -1 : 1
      if (bVal == null) return sortDirection === 'asc' ? 1 : -1
      
      if (isDColumn(sortColumn) || typeof aVal === 'number') {
        aVal = typeof aVal === 'number' ? aVal : parseFloat(aVal) || 0
        bVal = typeof bVal === 'number' ? bVal : parseFloat(bVal) || 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      aVal = String(aVal).toLowerCase()
      bVal = String(bVal).toLowerCase()
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortColumn, sortDirection])

  // Handle decision toggle for a row
  const handleDecisionChange = useCallback((ppgClusterId, decision) => {
    setRowDecisions(prev => ({
      ...prev,
      [ppgClusterId]: decision
    }))
    // Initialize tuning config with defaults when "Change" is selected
    if (decision === 'Change') {
      setRowTuningConfigs(prev => {
        if (!prev[ppgClusterId]) {
          return {
            ...prev,
            [ppgClusterId]: { operationType: 'S', configValue: '' }
          }
        }
        return prev
      })
    }
  }, [])

  // Handle tuning config change for a row
  const handleTuningConfigChange = useCallback((ppgClusterId, field, value) => {
    setRowTuningConfigs(prev => ({
      ...prev,
      [ppgClusterId]: {
        ...prev[ppgClusterId],
        [field]: value
      }
    }))
  }, [])

  // Reset all planned changes
  const resetDecisions = useCallback(() => {
    setRowDecisions({})
    setRowTuningConfigs({})
  }, [])

  // Get rows marked as "Change" with their details and tuning config
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

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    resetDecisions,
    getChangeDecisions
  }), [resetDecisions, getChangeDecisions])

  // Count decisions for display
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

  const columns = useMemo(() => {
    if (!data || data.length === 0) return []
    return Object.keys(data[0])
  }, [data])

  const { regularColumns, dColumns } = useMemo(() => {
    const regular = columns.filter(c => !isDColumn(c))
    const dCols = columns.filter(c => isDColumn(c))
    return { regularColumns: regular, dColumns: dCols }
  }, [columns])

  const frozenColumns = regularColumns.slice(0, FROZEN_COLUMN_COUNT)
  const scrollableRegularColumns = regularColumns.slice(FROZEN_COLUMN_COUNT)
  const allScrollableColumns = [...scrollableRegularColumns, ...dColumns]
  
  // Calculate total width: data columns + Action + Operation + Value
  const scrollableTableWidth = allScrollableColumns.length * SCROLLABLE_COL_WIDTH + ACTION_COL_WIDTH + OPERATION_COL_WIDTH + VALUE_COL_WIDTH

  const clearFilters = () => {
    setFilterHierarchy4('')
    setFilterHierarchy3('')
    setFilterHierarchy2('')
    setFilterHierarchy1('')
    setFilterPPGCluster('')
  }

  const clearSort = () => {
    setSortColumn(null)
    setSortDirection('asc')
  }

  if (loading) return <div className="loading">Loading markdown data...</div>
  if (error) return <div className="error-message">{error}</div>
  if (!data || data.length === 0) return <div className="loading">No markdown data available.</div>

  const cellStyle = {
    padding: '6px 10px',
    borderBottom: '1px solid #e0e0e0',
    textAlign: 'center',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    width: SCROLLABLE_COL_WIDTH,
    minWidth: SCROLLABLE_COL_WIDTH,
    maxWidth: SCROLLABLE_COL_WIDTH,
    boxSizing: 'border-box', overflow: 'hidden',
  }

  const headerCellStyle = {
    padding: '6px 10px',
    borderBottom: '2px solid #3a5ecc',
    fontSize: '12px',
    whiteSpace: 'normal',
    textAlign: 'center',
    verticalAlign: 'middle',
    background: '#4C7EFF',
    color: 'white',
    fontWeight: 'bold',
    width: SCROLLABLE_COL_WIDTH,
    minWidth: SCROLLABLE_COL_WIDTH,
    maxWidth: SCROLLABLE_COL_WIDTH,
    boxSizing: 'border-box',
    lineHeight: '1.3',
    cursor: 'pointer',
    userSelect: 'none',
  }

  const actionCellStyle = {
    padding: '6px 6px 4px 25px',
    borderBottom: '1px solid #e0e0e0',
    textAlign: 'center',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    width: ACTION_COL_WIDTH,
    minWidth: ACTION_COL_WIDTH,
    maxWidth: ACTION_COL_WIDTH,
    boxSizing: 'border-box',
    overflow: 'hidden',
    position: 'relative',
  }

  const actionHeaderStyle = {
    padding: '6px 5px 6px 20px',
    borderBottom: '2px solid #3a5ecc',
    whiteSpace: 'normal',
    textAlign: 'center',
    verticalAlign: 'middle',
    background: '#4C7EFF',
    color: 'white',
    fontWeight: 'bold',
    width: ACTION_COL_WIDTH,
    minWidth: ACTION_COL_WIDTH,
    maxWidth: ACTION_COL_WIDTH,
    boxSizing: 'border-box',
    lineHeight: '1.3',
  }

  const hasChangeRows = decisionCounts.change > 0
  const tuningHeaderStyle = {
    padding: '6px 10px 6px 0px',
    borderBottom: '2px solid #3a5ecc',
    fontSize: '12px',
    whiteSpace: 'normal',
    textAlign: 'center',
    verticalAlign: 'middle',
    background: hasChangeRows ? '#28a745' : '#4C7EFF',
    color: 'white',
    fontWeight: 'bold',
    boxSizing: 'border-box',
    lineHeight: '1.3',
  }

  const tuningCellStyle = {
    padding: '4px 6px',
    borderBottom: '1px solid #e0e0e0',
    textAlign: 'center',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  }

  return (
    <div className="markdown-table-container">
      {/* Filter Controls */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '12px', 
        marginBottom: '16px',
        padding: '16px',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
            Hierarchy Level 4
          </label>
          <select 
            value={filterHierarchy4} 
            onChange={(e) => setFilterHierarchy4(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">All</option>
            {uniqueValues.hierarchy4?.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
            Hierarchy Level 3
          </label>
          <select 
            value={filterHierarchy3} 
            onChange={(e) => setFilterHierarchy3(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">All</option>
            {uniqueValues.hierarchy3?.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
            Hierarchy Level 2
          </label>
          <select 
            value={filterHierarchy2} 
            onChange={(e) => setFilterHierarchy2(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">All</option>
            {uniqueValues.hierarchy2?.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
            Hierarchy Level 1
          </label>
          <select 
            value={filterHierarchy1} 
            onChange={(e) => setFilterHierarchy1(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">All</option>
            {uniqueValues.hierarchy1?.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ width: '80px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
            PPG Cluster ID
          </label>
          <input
            type="text"
            value={filterPPGCluster}
            onChange={(e) => setFilterPPGCluster(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button 
            onClick={clearFilters}
            style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Clear Filters
          </button>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 16px',
          background: hideLeaveRows ? '#d4edda' : '#fff',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <input
            type="checkbox"
            id="hideLeaveRows"
            checked={hideLeaveRows}
            onChange={(e) => setHideLeaveRows(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="hideLeaveRows" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Hide "Leave" rows
          </label>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 16px',
          background: hideChangeRows ? '#f8d7da' : '#fff',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <input
            type="checkbox"
            id="hideChangeRows"
            checked={hideChangeRows}
            onChange={(e) => setHideChangeRows(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="hideChangeRows" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Hide "Change" rows
          </label>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 16px',
          background: showOnlyChangeRows ? '#fff3cd' : '#fff',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <input
            type="checkbox"
            id="showOnlyChangeRows"
            checked={showOnlyChangeRows}
            onChange={(e) => setShowOnlyChangeRows(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="showOnlyChangeRows" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Show Only "Change" rows
          </label>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 16px',
          background: hideResetRows ? '#e2e3e5' : '#fff',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <input
            type="checkbox"
            id="hideResetRows"
            checked={hideResetRows}
            onChange={(e) => setHideResetRows(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="hideResetRows" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Hide "Reset" rows
          </label>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 16px',
          background: showOnlyResetRows ? '#e2e3e5' : '#fff',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <input
            type="checkbox"
            id="showOnlyResetRows"
            checked={showOnlyResetRows}
            onChange={(e) => setShowOnlyResetRows(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="showOnlyResetRows" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Show Only "Reset" rows
          </label>
        </div>
      </div>

      {/* Decision Summary */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '16px', 
        marginBottom: '12px',
        fontSize: '13px'
      }}>
        <span style={{ color: '#28a745' }}>✓ Leave: <strong>{decisionCounts.leave}</strong></span>
        <span style={{ color: '#dc3545' }}>⚠ Change: <strong>{decisionCounts.change}</strong></span>
        <span style={{ color: '#6c757d' }}>↺ Reset: <strong>{decisionCounts.reset}</strong></span>
        <span style={{ color: '#6c757d' }}>○ Undecided: <strong>{decisionCounts.undecided}</strong></span>
        {sortColumn && (
          <span style={{ marginLeft: 'auto', color: '#666' }}>
            Sorted by: <strong>{sortColumn}</strong> ({sortDirection === 'asc' ? '↑ ascending' : '↓ descending'})
            <button 
              onClick={clearSort}
              style={{ 
                marginLeft: '8px', 
                padding: '2px 8px', 
                fontSize: '11px', 
                background: '#6c757d', 
                color: 'white', 
                border: 'none', 
                borderRadius: '3px', 
                cursor: 'pointer' 
              }}
            >
              Clear Sort
            </button>
          </span>
        )}
      </div>

      {/* Results count */}
      <p style={{ marginBottom: '12px', color: '#666' }}>
        Showing <strong>{sortedData.length}</strong> of <strong>{data.length}</strong> rows
      </p>

      {/* Table Grid - 4 quadrants for freeze panes */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: `${TOTAL_FROZEN_WIDTH}px 1fr`,
        gridTemplateRows: 'auto 1fr',
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden',
        maxHeight: '420px'
      }}>
        
        {/* Top-Left: Frozen Headers */}
        <div style={{ 
          background: '#4C7EFF',
          borderRight: '2px solid #3a5ecc',
          borderBottom: '2px solid #3a5ecc',
          overflow: 'hidden'
        }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: TOTAL_FROZEN_WIDTH }}>
            <thead>
              <tr>
                {frozenColumns.map((col, idx) => (
                  <th 
                    key={col} 
                    onClick={() => handleSort(col)}
                    style={{ 
                      ...headerCellStyle, 
                      width: FROZEN_COL_WIDTHS[idx], 
                      minWidth: FROZEN_COL_WIDTHS[idx],
                      maxWidth: FROZEN_COL_WIDTHS[idx],
                      background: sortColumn === col ? '#3a5ecc' : '#4C7EFF'
                    }}
                  >
                    {renderHeader(col)}
                    <SortIndicator column={col} sortColumn={sortColumn} sortDirection={sortDirection} />
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Top-Right: Scrollable Headers */}
        <div 
          ref={headerScrollRef}
          style={{ 
            overflowX: 'hidden',
            overflowY: 'hidden',
            background: '#4C7EFF',
            borderBottom: '2px solid #3a5ecc'
          }}
        >
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: scrollableTableWidth }}>
            <thead>
              <tr>
                {allScrollableColumns.map((col) => {
                  const bgColor = getColumnColor(col, true) || '#4C7EFF'
                  const textColor = getColumnColor(col, true) ? '#333' : 'white'
                  const isActive = sortColumn === col
                  return (
                    <th 
                      key={col} 
                      onClick={() => handleSort(col)}
                      style={{ 
                        ...headerCellStyle, 
                        background: isActive ? (getColumnColor(col, true) ? '#888' : '#3a5ecc') : bgColor, 
                        color: textColor 
                      }}
                    >
                      {renderHeader(col)}
                      <SortIndicator column={col} sortColumn={sortColumn} sortDirection={sortDirection} />
                    </th>
                  )
                })}
                {/* Action Column Header */}
                <th style={actionHeaderStyle}>
                  Action
                </th>
                {/* Operation Column Header */}
                <th style={{ ...tuningHeaderStyle, width: OPERATION_COL_WIDTH, minWidth: OPERATION_COL_WIDTH, maxWidth: OPERATION_COL_WIDTH }}>
                  Operation
                </th>
                {/* Value Column Header */}
                <th style={{ ...tuningHeaderStyle, width: VALUE_COL_WIDTH, minWidth: VALUE_COL_WIDTH, maxWidth: VALUE_COL_WIDTH }}>
                  Value
                </th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Bottom-Left: Frozen Body Cells */}
        <div 
          ref={frozenBodyRef}
          onScroll={handleFrozenBodyScroll}
          style={{ 
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '2px solid #ccc',
            maxHeight: '380px'
          }}
        >
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: TOTAL_FROZEN_WIDTH }}>
            <tbody>
              {sortedData.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  {frozenColumns.map((col, colIdx) => (
                    <td key={col} style={{ 
                      ...cellStyle, 
                      width: FROZEN_COL_WIDTHS[colIdx], 
                      minWidth: FROZEN_COL_WIDTHS[colIdx],
                      maxWidth: FROZEN_COL_WIDTHS[colIdx],
                      background: 'inherit'
                    }}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : 'NULL'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom-Right: Scrollable Body Cells */}
        <div 
          ref={bodyScrollRef}
          onScroll={handleScrollableBodyScroll}
          style={{ 
            overflow: 'auto',
            maxHeight: '380px'
          }}
        >
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
                      return (
                        <td key={col} style={{ ...cellStyle, background: bgColor || 'inherit' }}>
                          {displayValue}
                        </td>
                      )
                    })}
                    {/* Action Column Cell */}
                    <td style={{ 
                      ...actionCellStyle, 
                      background: currentDecision === 'Leave' ? '#d4edda' : currentDecision === 'Change' ? '#fff3cd' : currentDecision === 'Reset' ? '#f8d7da' : 'inherit'
                    }}>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
                        <button
                          onClick={() => handleDecisionChange(ppgId, currentDecision === 'Leave' ? null : 'Leave')}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            background: currentDecision === 'Leave' ? '#28a745' : '#e9ecef',
                            color: currentDecision === 'Leave' ? 'white' : '#495057',
                            fontWeight: currentDecision === 'Leave' ? 'bold' : 'normal'
                          }}
                        >
                          Leave
                        </button>
                        <button
                          onClick={() => handleDecisionChange(ppgId, currentDecision === 'Change' ? null : 'Change')}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            background: currentDecision === 'Change' ? '#dc3545' : '#e9ecef',
                            color: currentDecision === 'Change' ? 'white' : '#495057',
                            fontWeight: currentDecision === 'Change' ? 'bold' : 'normal'
                          }}
                        >
                          Change
                        </button>
                        <button
                          onClick={() => handleDecisionChange(ppgId, currentDecision === 'Reset' ? null : 'Reset')}
                          disabled={!hasNonZeroDValues(row)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: hasNonZeroDValues(row) ? 'pointer' : 'not-allowed',
                            background: currentDecision === 'Reset' ? '#6c757d' : (hasNonZeroDValues(row) ? '#e9ecef' : '#f5f5f5'),
                            color: currentDecision === 'Reset' ? 'white' : (hasNonZeroDValues(row) ? '#495057' : '#adb5bd'),
                            fontWeight: currentDecision === 'Reset' ? 'bold' : 'normal'
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                    {/* Operation Column Cell */}
                    <td style={{ 
                      ...tuningCellStyle, 
                      width: OPERATION_COL_WIDTH,
                      minWidth: OPERATION_COL_WIDTH,
                      maxWidth: OPERATION_COL_WIDTH,
                      paddingLeft: '25px',
                      background: isChangeSelected ? '#d4edda' : 'inherit'
                    }}>
                      <select
                        value={tuningConfig.operationType}
                        onChange={(e) => handleTuningConfigChange(ppgId, 'operationType', e.target.value)}
                        disabled={!isChangeSelected}
                        style={{
                          width: '100%',
                          padding: '2px 4px',
                          fontSize: '11px',
                          borderRadius: '3px',
                          border: '1px solid #ddd',
                          background: isChangeSelected ? 'white' : '#f5f5f5',
                          color: isChangeSelected ? '#333' : '#999',
                          cursor: isChangeSelected ? 'pointer' : 'not-allowed'
                        }}
                      >
                        {OPERATION_TYPES.map(op => (
                          <option key={op.code} value={op.code}>{op.label}</option>
                        ))}
                      </select>
                    </td>
                    {/* Value Column Cell */}
                    <td style={{ 
                      ...tuningCellStyle, 
                      width: VALUE_COL_WIDTH,
                      minWidth: VALUE_COL_WIDTH,
                      maxWidth: VALUE_COL_WIDTH,
                      paddingLeft: '25px',
                      background: isChangeSelected ? '#d4edda' : 'inherit'
                    }}>
                      <input
                        type="number"
                        step="0.01"
                        value={tuningConfig.configValue}
                        onChange={(e) => handleTuningConfigChange(ppgId, 'configValue', e.target.value)}
                        disabled={!isChangeSelected}
                        placeholder="0.00"
                        style={{
                          width: '100%',
                          padding: '2px 4px',
                          fontSize: '11px',
                          borderRadius: '3px',
                          border: '1px solid #ddd',
                          textAlign: 'center',
                          background: isChangeSelected ? 'white' : '#f5f5f5',
                          color: isChangeSelected ? '#333' : '#999',
                          cursor: isChangeSelected ? 'text' : 'not-allowed',
                          boxSizing: 'border-box'
                        }}
                      />
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







