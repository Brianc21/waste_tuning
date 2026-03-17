import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

function SettingsModal({ isOpen, onClose, currentConfig, onSave, onQueriesUpdated }) {
  const [activeTab, setActiveTab] = useState('database')
  
  // Database settings state
  const [server, setServer] = useState('')
  const [database, setDatabase] = useState('')
  const [port, setPort] = useState('1433')
  const [dbLoading, setDbLoading] = useState(false)
  const [dbError, setDbError] = useState(null)
  const [dbSuccess, setDbSuccess] = useState(null)

  // Query editor state
  const [queries, setQueries] = useState([])
  const [selectedQueryId, setSelectedQueryId] = useState('')
  const [editedSql, setEditedSql] = useState('')
  const [originalSql, setOriginalSql] = useState('')
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState(null)
  const [querySuccess, setQuerySuccess] = useState(null)

  // Fetch config directly from API (fallback when prop is empty)
  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/config`)
      if (response.data.success) {
        setServer(response.data.server || '')
        setDatabase(response.data.database || '')
        setPort(response.data.port || '1433')
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
      setDbError('Could not load current settings from server. Please enter your database connection details.')
    }
  }

  useEffect(() => {
    if (isOpen) {
      // Load database config from prop first, fallback to API fetch
      if (currentConfig && currentConfig.server) {
        setServer(currentConfig.server || '')
        setDatabase(currentConfig.database || '')
        setPort(currentConfig.port || '1433')
      } else {
        // Prop is empty - fetch directly from API
        fetchConfig()
      }
      setDbError(null)
      setDbSuccess(null)
      
      // Load queries
      loadQueries()
    }
  }, [isOpen, currentConfig])

  const loadQueries = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/queries`)
      if (response.data.success) {
        setQueries(response.data.queries || [])
        // Select first query by default
        if (response.data.queries?.length > 0 && !selectedQueryId) {
          const firstQuery = response.data.queries[0]
          setSelectedQueryId(firstQuery.id)
          setEditedSql(firstQuery.sql)
          setOriginalSql(firstQuery.sql)
        }
      }
      setQueryError(null)
      setQuerySuccess(null)
    } catch (err) {
      console.error('Failed to load queries:', err)
      setQueryError('Failed to load queries')
    }
  }

  const handleQuerySelect = (queryId) => {
    const query = queries.find(q => q.id === queryId)
    if (query) {
      setSelectedQueryId(queryId)
      setEditedSql(query.sql)
      setOriginalSql(query.sql)
      setQueryError(null)
      setQuerySuccess(null)
    }
  }

  const handleSaveDatabase = async () => {
    if (!server.trim() || !database.trim()) {
      setDbError('Server and Database are required')
      return
    }

    setDbLoading(true)
    setDbError(null)
    setDbSuccess(null)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/config`, {
        server: server.trim(),
        database: database.trim(),
        port: port.trim() || '1433',
        old_database: currentConfig?.database
      })

      if (response.data.success) {
        setDbSuccess('Settings saved! Please restart the dashboard for changes to take effect.')
        if (onSave) onSave(response.data)
      } else {
        setDbError(response.data.error || 'Failed to save settings')
      }
    } catch (err) {
      setDbError(err.response?.data?.detail || err.message)
    } finally {
      setDbLoading(false)
    }
  }

  const handleSaveQuery = async () => {
    if (!selectedQueryId) return

    setQueryLoading(true)
    setQueryError(null)
    setQuerySuccess(null)

    try {
      const response = await axios.put(`${API_BASE_URL}/api/queries/${selectedQueryId}`, {
        sql: editedSql
      })

      if (response.data.success) {
        setQuerySuccess('Query saved successfully!')
        setOriginalSql(editedSql)
        // Update local state
        setQueries(queries.map(q => 
          q.id === selectedQueryId ? { ...q, sql: editedSql } : q
        ))
        // Notify parent to reload queries
        if (onQueriesUpdated) onQueriesUpdated()
      } else {
        setQueryError(response.data.error || 'Failed to save query')
      }
    } catch (err) {
      setQueryError(err.response?.data?.detail || err.message)
    } finally {
      setQueryLoading(false)
    }
  }

  const handleResetQuery = async () => {
    if (!selectedQueryId) return

    if (!confirm(`Reset "${queries.find(q => q.id === selectedQueryId)?.name}" to default?`)) {
      return
    }

    setQueryLoading(true)
    setQueryError(null)
    setQuerySuccess(null)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/queries/${selectedQueryId}/reset`)

      if (response.data.success) {
        const resetQuery = response.data.query
        setEditedSql(resetQuery.sql)
        setOriginalSql(resetQuery.sql)
        setQuerySuccess('Query reset to default!')
        // Update local state
        setQueries(queries.map(q => 
          q.id === selectedQueryId ? resetQuery : q
        ))
        // Notify parent to reload queries
        if (onQueriesUpdated) onQueriesUpdated()
      } else {
        setQueryError(response.data.error || 'Failed to reset query')
      }
    } catch (err) {
      setQueryError(err.response?.data?.detail || err.message)
    } finally {
      setQueryLoading(false)
    }
  }

  const handleResetAllQueries = async () => {
    if (!confirm('Reset ALL queries to defaults? This cannot be undone.')) {
      return
    }

    setQueryLoading(true)
    setQueryError(null)
    setQuerySuccess(null)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/queries/reset`)

      if (response.data.success) {
        setQueries(response.data.queries || [])
        // Reset current selection
        if (response.data.queries?.length > 0) {
          const currentQuery = response.data.queries.find(q => q.id === selectedQueryId)
          if (currentQuery) {
            setEditedSql(currentQuery.sql)
            setOriginalSql(currentQuery.sql)
          }
        }
        setQuerySuccess('All queries reset to defaults!')
        // Notify parent to reload queries
        if (onQueriesUpdated) onQueriesUpdated()
      } else {
        setQueryError(response.data.error || 'Failed to reset queries')
      }
    } catch (err) {
      setQueryError(err.response?.data?.detail || err.message)
    } finally {
      setQueryLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedQuery = queries.find(q => q.id === selectedQueryId)
  const hasChanges = editedSql !== originalSql

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: activeTab === tab ? '3px solid #007bff' : '3px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: activeTab === tab ? '600' : '400',
    color: activeTab === tab ? '#007bff' : '#666'
  })

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '0',
        width: '800px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0 24px' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚙️</span> Settings
          </h2>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #ddd',
          padding: '16px 24px 0 24px'
        }}>
          <button style={tabStyle('database')} onClick={() => setActiveTab('database')}>
            Database Connection
          </button>
          <button style={tabStyle('queries')} onClick={() => setActiveTab('queries')}>
            Query Editor
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          
          {/* Database Tab */}
          {activeTab === 'database' && (
            <>
              {dbError && (
                <div style={{
                  background: '#f8d7da',
                  color: '#721c24',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  {dbError}
                </div>
              )}

              {dbSuccess && (
                <div style={{
                  background: '#d4edda',
                  color: '#155724',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  {dbSuccess}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  SQL Server
                </label>
                <input
                  type="text"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="e.g., hebwmddev-sqlvm.ri-team.net"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Database
                </label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="e.g., WASTE_HEB"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Port
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="1433"
                  style={inputStyle}
                />
              </div>

              <div style={{
                background: '#fff3cd',
                color: '#856404',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '20px',
                fontSize: '13px'
              }}>
                ⚠️ <strong>Restart required:</strong> After saving, close and restart the dashboard for changes to take effect.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    background: 'white',
                    color: '#333',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'normal',
                    width: 'auto'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDatabase}
                  disabled={dbLoading || !server.trim() || !database.trim()}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    background: dbLoading || !server.trim() || !database.trim() ? '#ccc' : '#007bff',
                    color: 'white',
                    cursor: dbLoading || !server.trim() || !database.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    width: 'auto'
                  }}
                >
                  {dbLoading ? 'Saving...' : 'Save Database Settings'}
                </button>
              </div>
            </>
          )}

          {/* Query Editor Tab */}
          {activeTab === 'queries' && (
            <>
              {queryError && (
                <div style={{
                  background: '#f8d7da',
                  color: '#721c24',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  {queryError}
                </div>
              )}

              {querySuccess && (
                <div style={{
                  background: '#d4edda',
                  color: '#155724',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  {querySuccess}
                </div>
              )}

              {/* Query selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Select Query
                </label>
                <select
                  value={selectedQueryId}
                  onChange={(e) => handleQuerySelect(e.target.value)}
                  style={{
                    ...inputStyle,
                    cursor: 'pointer'
                  }}
                >
                  {queries.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.name} ({q.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Query description */}
              {selectedQuery && (
                <div style={{ 
                  marginBottom: '16px',
                  padding: '10px',
                  background: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#666'
                }}>
                  <strong>Description:</strong> {selectedQuery.description}
                  {selectedQuery.isBatch && (
                    <span style={{ 
                      marginLeft: '10px',
                      padding: '2px 6px',
                      background: '#e7f3ff',
                      color: '#004085',
                      borderRadius: '3px',
                      fontSize: '11px'
                    }}>
                      BATCH QUERY
                    </span>
                  )}
                </div>
              )}

              {/* SQL editor */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  SQL {hasChanges && <span style={{ color: '#dc3545', fontWeight: 'normal' }}>(modified)</span>}
                </label>
                <textarea
                  value={editedSql}
                  onChange={(e) => setEditedSql(e.target.value)}
                  style={{
                    ...inputStyle,
                    minHeight: '300px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <button
                    onClick={handleResetAllQueries}
                    disabled={queryLoading}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      background: 'white',
                      color: '#dc3545',
                      cursor: queryLoading ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Reset All to Defaults
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleResetQuery}
                    disabled={queryLoading || !selectedQueryId}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #6c757d',
                      borderRadius: '4px',
                      background: 'white',
                      color: '#6c757d',
                      cursor: queryLoading || !selectedQueryId ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Reset This Query
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #6c757d',
                      borderRadius: '4px',
                      background: 'white',
                      color: '#6c757d',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveQuery}
                    disabled={queryLoading || !hasChanges}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      background: queryLoading || !hasChanges ? '#ccc' : '#007bff',
                      color: 'white',
                      cursor: queryLoading || !hasChanges ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    {queryLoading ? 'Saving...' : 'Save Query'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
