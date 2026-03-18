import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { onLoadQueries, dashboardQueries } from './queries'
import MarkdownTable from './MarkdownTable'
import SettingsModal from './SettingsModal'

const API_BASE_URL = 'http://localhost:8000'

const OPERATION_TYPES = [
  { code: 'S', label: 'Subtract' },
  { code: 'A', label: 'Add' },
  { code: 'M', label: 'Multiply' },
  { code: 'D', label: 'Divide' },
  { code: 'O', label: 'Override' }
]

function CloneConfigModal({ isOpen, onClose, activeVersion, onSuccess }) {
  const [versionName, setVersionName] = useState('')
  const [comment, setComment] = useState('')
  const [cloneFromVersionId, setCloneFromVersionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (isOpen && activeVersion && activeVersion.length > 0) {
      const active = activeVersion[0]
      const today = new Date().toISOString().split('T')[0]
      setVersionName(`${today}_Clone`)
      setComment(`Cloned from ${active.VersionName}`)
      setCloneFromVersionId(String(active.VersionID))
      setError(null); setSuccess(null)
    }
  }, [isOpen, activeVersion])

  const handleClone = async () => {
    if (!versionName.trim() || !comment.trim() || !cloneFromVersionId.trim()) { setError('All fields are required'); return }
    setLoading(true); setError(null); setSuccess(null)
    const sql = `DECLARE @NewVersionID INT;
EXEC config.csp_ConfigVersionCreate
    @VersionName = '${versionName.replace(/'/g, "''")}'
    , @Comment = '${comment.replace(/'/g, "''")}'
    , @CreatedBy = NULL
    , @CloneFromVersionID = ${parseInt(cloneFromVersionId, 10)}
    , @NewVersionID = @NewVersionID OUTPUT;
SELECT @NewVersionID AS NewVersionID;`
    try {
      const response = await axios.post(`${API_BASE_URL}/api/query/batch`, { query: sql, params: null })
      if (response.data.success) { const newId = response.data.data?.[0]?.NewVersionID; setSuccess(`Successfully created new config version${newId ? ` (ID: ${newId})` : ''}!`); if (onSuccess) onSuccess() }
      else setError(response.data.error || 'Failed to clone config version')
    } catch (err) { setError(err.response?.data?.detail || err.message) }
    finally { setLoading(false) }
  }

  if (!isOpen) return null
  const activeVersionId = activeVersion?.[0]?.VersionID || 'Unknown'

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '480px', maxWidth: '90vw', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Clone Config Version</h2>
        {['Version Name', 'Comment', 'Clone From Version ID'].map((label, i) => {
          const vals = [versionName, comment, cloneFromVersionId]
          const setters = [setVersionName, setComment, setCloneFromVersionId]
          const placeholders = ['e.g., 2026-03-10_ExtraDepts_1', 'Description of this version', 'Version ID to clone from']
          const types = ['text', 'text', 'number']
          return (
            <div key={label} style={{ marginBottom: i === 2 ? '20px' : '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#555' }}>{label} <span style={{ color: '#dc3545' }}>*</span></label>
              <input type={types[i]} value={vals[i]} onChange={(e) => setters[i](e.target.value)} placeholder={placeholders[i]} disabled={loading || success}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', backgroundColor: (loading || success) ? '#f5f5f5' : 'white' }} />
            </div>
          )
        })}
        {error && <div style={{ padding: '10px 12px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>Error: {error}</div>}
        {success && <div style={{ padding: '10px 12px', background: '#d4edda', color: '#155724', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>Success: {success}</div>}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>{success ? 'Close' : 'Cancel'}</button>
          {!success && <button onClick={handleClone} disabled={loading} style={{ padding: '10px 20px', background: loading ? '#ccc' : '#4C7EFF', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}>{loading ? 'Cloning...' : 'Clone'}</button>}
        </div>
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #eee', fontSize: '13px', color: '#666' }}>Current Active Version is: <strong>{activeVersionId}</strong></div>
      </div>
    </div>
  )
}

function TuneDefaultPercentagesModal({ isOpen, onClose, changeDecisions, maxVersion, activeVersion, onSuccess, onWriteQuery, onMarkSubmitted }) {
  const getDefaultComment = () => { const now = new Date(); return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_1` }
  const [tuningConfigs, setTuningConfigs] = useState([])
  const [versionId, setVersionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (isOpen && changeDecisions && changeDecisions.length > 0) {
      const defaultComment = getDefaultComment()
      setTuningConfigs(changeDecisions.map(row => ({ PPGClusterID: row.PPGClusterID, HierarchyLevel4Name: row.HierarchyLevel4Name, HierarchyLevel3Name: row.HierarchyLevel3Name, HierarchyLevel2Name: row.HierarchyLevel2Name, HierarchyLevel1Name: row.HierarchyLevel1Name, decision: row.decision || 'Change', operationType: row.operationType || 'S', configValue: row.configValue || '0.00', comment: defaultComment })))
      setError(null); setSuccess(null)
    }
    if (isOpen && maxVersion && maxVersion.length > 0) setVersionId(String(maxVersion[0].VersionID))
  }, [isOpen, changeDecisions, maxVersion])

  const updateConfig = (index, field, value) => { setTuningConfigs(prev => { const updated = [...prev]; updated[index] = { ...updated[index], [field]: value }; return updated }) }
  const applyToAll = (field, value) => { setTuningConfigs(prev => prev.map(config => ({ ...config, [field]: value }))) }

  const handleTune = async () => {
    if (!versionId.trim()) { setError('Version ID is required'); return }
    const changeRows = tuningConfigs.filter(c => c.decision === 'Change')
    const resetRows = tuningConfigs.filter(c => c.decision === 'Reset')
    if (changeRows.length === 0 && resetRows.length === 0) { setError('No PPG Clusters selected for tuning or reset'); return }
    for (const config of changeRows) { if (!config.configValue || config.configValue === '') { setError(`Config value is required for PPG ${config.PPGClusterID}`); return } }
    const parsedVersionId = parseInt(versionId, 10)
    const activeVersionId = activeVersion?.[0]?.VersionID
    if (activeVersionId && parsedVersionId === activeVersionId) {
      const confirmed = window.confirm(`⚠️ WARNING: You are about to modify the ACTIVE config version (Version ${activeVersionId}).\n\nAre you sure you want to proceed?`)
      if (!confirmed) return
    }
    let queries = []
    if (changeRows.length > 0) {
      const valuesRows = changeRows.map(config => `    ('${config.PPGClusterID}','${config.operationType}','${config.configValue}','${config.comment.replace(/'/g, "''")}')`).join(',\n')
      queries.push(`DECLARE @VersionID INT = ${parsedVersionId}\nDECLARE @ConfigData AS config.BulkConfigDefaultPercentage;\nDECLARE @EffectiveFrom DATETIME2(0) = NULL;\nDECLARE @EffectiveTo DATETIME2(0) = NULL;\n\nINSERT INTO @ConfigData (PPGClusterID, ConfigOperationType, ConfigValue, Comment)\nVALUES\n${valuesRows}\n\nEXEC config.csp_BulkConfigUpsertDefaultPercentage\n    @ConfigData = @ConfigData\n    , @VersionID = @VersionID\n    , @EffectiveFrom = @EffectiveFrom\n    , @EffectiveTo = @EffectiveTo;`)
    }
    if (resetRows.length > 0) { const ppgIds = resetRows.map(c => c.PPGClusterID).join(', '); queries.push(`DELETE FROM [WASTE_HEB].[config].[DefaultPercentage] WHERE VersionID = ${parsedVersionId} AND PPGClusterID IN (${ppgIds})`) }
    const combinedSql = queries.join('\n\n')
    if (onWriteQuery) { onWriteQuery(combinedSql); onClose(); return }
    setLoading(true); setError(null); setSuccess(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/query/batch`, { query: combinedSql, params: null })
      if (response.data.success) {
        const messages = []
        if (changeRows.length > 0) messages.push(`tuned ${changeRows.length} PPG Cluster(s)`)
        if (resetRows.length > 0) messages.push(`reset ${resetRows.length} PPG Cluster(s)`)
        setSuccess(`Successfully ${messages.join(' and ')} in Version ${versionId}!`)
        const submittedIds = [...changeRows, ...resetRows].map(c => c.PPGClusterID)
        if (onMarkSubmitted) onMarkSubmitted(parsedVersionId, submittedIds)
        if (onSuccess) onSuccess()
      } else { setError(response.data.error || 'Failed to execute tuning query') }
    } catch (err) { setError(err.response?.data?.detail || err.message) }
    finally { setLoading(false) }
  }

  if (!isOpen) return null
  if (!changeDecisions || changeDecisions.length === 0) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '500px', maxWidth: '90vw', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Tune Default Percentages</h2>
          <div style={{ padding: '20px', background: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '20px' }}>Warning: No PPG Clusters are marked as "Change".<br /><br />Please mark rows as "Change" before using this tuning action.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onClose} style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Close</button></div>
        </div>
      </div>
    )
  }

  const inputStyle = { padding: '6px 8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box' }
  const maxVersionId = maxVersion?.[0]?.VersionID || 'Unknown'
  const isLocked = loading || success

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '1200px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#333' }}>Tune Default Percentages</h2>
        <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>Configure tuning parameters below.<span style={{ marginLeft: '16px', color: '#555' }}>MAX Version ID: <strong>{maxVersionId}</strong></span></p>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontWeight: '500', color: '#555', minWidth: '80px' }}>Version ID:</label>
          <input type="number" value={versionId} onChange={(e) => setVersionId(e.target.value)} disabled={isLocked} style={{ ...inputStyle, width: '100px', backgroundColor: isLocked ? '#f5f5f5' : 'white' }} />
        </div>
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', opacity: isLocked ? 0.6 : 1 }}>
          <span style={{ fontWeight: '500', color: '#555' }}>Apply to all:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><label style={{ fontSize: '13px' }}>Operation:</label><select onChange={(e) => applyToAll('operationType', e.target.value)} disabled={isLocked} style={{ ...inputStyle, width: '100px' }}><option value="">Select...</option>{OPERATION_TYPES.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}</select></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><label style={{ fontSize: '13px' }}>Value:</label><input type="number" step="0.01" placeholder="0.00" onChange={(e) => applyToAll('configValue', e.target.value)} disabled={isLocked} style={{ ...inputStyle, width: '80px' }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><label style={{ fontSize: '13px' }}>Comment:</label><input type="text" placeholder={getDefaultComment()} onChange={(e) => applyToAll('comment', e.target.value)} disabled={isLocked} maxLength={214} style={{ ...inputStyle, width: '300px' }} /></div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '16px', opacity: isLocked ? 0.6 : 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#4C7EFF', color: 'white' }}>
              <tr>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', width: '90px' }}>PPG ID</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>Level 4</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>Level 3</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>Level 2</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>Level 1</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', width: '110px' }}>Operation</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', width: '90px' }}>Value</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', width: '320px', minWidth: '320px' }}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {tuningConfigs.filter(c => c.decision === "Change").map((config, index) => (
                <tr key={config.PPGClusterID} style={{ background: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  <td style={{ padding: '8px 10px', fontWeight: '500' }}>{config.PPGClusterID}</td>
                  <td style={{ padding: '8px 10px', color: '#666', fontSize: '12px' }}>{config.HierarchyLevel4Name}</td>
                  <td style={{ padding: '8px 10px', color: '#666', fontSize: '12px' }}>{config.HierarchyLevel3Name}</td>
                  <td style={{ padding: '8px 10px', color: '#666', fontSize: '12px' }}>{config.HierarchyLevel2Name}</td>
                  <td style={{ padding: '8px 10px', color: '#666', fontSize: '12px' }}>{config.HierarchyLevel1Name}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><select value={config.operationType} onChange={(e) => updateConfig(index, 'operationType', e.target.value)} disabled={isLocked} style={{ ...inputStyle, width: '100%' }}>{OPERATION_TYPES.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}</select></td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><input type="number" step="0.01" value={config.configValue} onChange={(e) => updateConfig(index, 'configValue', e.target.value)} disabled={isLocked} style={{ ...inputStyle, width: '100%', textAlign: 'center' }} /></td>
                  <td style={{ padding: '8px 10px' }}><input type="text" value={config.comment} onChange={(e) => updateConfig(index, 'comment', e.target.value)} disabled={isLocked} style={{ ...inputStyle, width: '100%' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tuningConfigs.filter(c => c.decision === 'Reset').length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#721c24', fontSize: '14px' }}>↺ PPG Clusters to Reset ({tuningConfigs.filter(c => c.decision === 'Reset').length})</h4>
            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px' }}>These will be deleted from the DefaultPercentage table for the selected Version.</p>
            <div style={{ border: '1px solid #f5c6cb', borderRadius: '4px', background: '#fff', maxHeight: '150px', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8d7da', color: '#721c24' }}>
                  <tr>{['PPG ID','Level 4','Level 3','Level 2','Level 1'].map(h => <th key={h} style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {tuningConfigs.filter(c => c.decision === 'Reset').map((config, idx) => (
                    <tr key={config.PPGClusterID} style={{ background: idx % 2 === 0 ? '#fff' : '#fef2f2' }}>
                      <td style={{ padding: '6px 8px', fontWeight: '500' }}>{config.PPGClusterID}</td>
                      <td style={{ padding: '6px 8px', color: '#666' }}>{config.HierarchyLevel4Name}</td>
                      <td style={{ padding: '6px 8px', color: '#666' }}>{config.HierarchyLevel3Name}</td>
                      <td style={{ padding: '6px 8px', color: '#666' }}>{config.HierarchyLevel2Name}</td>
                      <td style={{ padding: '6px 8px', color: '#666' }}>{config.HierarchyLevel1Name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {error && <div style={{ padding: '10px 12px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>Error: {error}</div>}
        {success && <div style={{ padding: '10px 12px', background: '#d4edda', color: '#155724', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>Success: {success}</div>}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>{success ? 'Close' : 'Cancel'}</button>
          {!success && <button onClick={handleTune} disabled={loading} style={{ padding: '10px 20px', background: loading ? '#ccc' : '#4C7EFF', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}>{loading ? 'Tuning...' : 'Tune'}</button>}
        </div>
      </div>
    </div>
  )
}

function ActivateConfigModal({ isOpen, onClose, maxVersion, onSuccess }) {
  const [versionId, setVersionId] = useState('')
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (isOpen) {
      if (maxVersion && maxVersion.length > 0) setVersionId(String(maxVersion[0].VersionID))
      setError(null); setSuccess(null); loadVersions()
    }
  }, [isOpen, maxVersion])

  const loadVersions = async () => {
    setLoadingVersions(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/query`, { query: `SELECT [VersionID],[VersionName],[Comment],[CreatedBy],[CreatedOnUTC],[IsActive],[IsLocked],[IsProtected] FROM [WASTE_HEB].[config].[ConfigVersions] ORDER BY [VersionID] DESC`, params: [] })
      if (response.data.success) setVersions(response.data.data || [])
    } catch (err) { console.error('Failed to load versions:', err) }
    finally { setLoadingVersions(false) }
  }

  const handleActivate = async () => {
    if (!versionId.trim()) { setError('Version ID is required'); return }
    const parsedVersionId = parseInt(versionId, 10)
    if (isNaN(parsedVersionId)) { setError('Version ID must be a number'); return }
    const confirmed = window.confirm(`Are you sure you want to activate Config Version ${parsedVersionId}?\n\nThis will make Version ${parsedVersionId} the active configuration.`)
    if (!confirmed) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/query/batch`, { query: `EXEC config.csp_ConfigVersionActivate @VersionID = ${parsedVersionId} , @Activate = 1 , @CreatedBy = NULL`, params: null })
      if (response.data.success) { setSuccess(`Successfully activated config version ${parsedVersionId}!`); if (onSuccess) onSuccess() }
      else setError(response.data.error || 'Failed to activate config version')
    } catch (err) { setError(err.response?.data?.detail || err.message) }
    finally { setLoading(false) }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '700px', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#333' }}>Activate Config Version</h2>
        {error && <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#721c24' }}>{error}</div>}
        {success && <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#155724' }}>{success}</div>}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#333' }}>Version ID to Activate:</label>
          <input type="number" value={versionId} onChange={(e) => setVersionId(e.target.value)} style={{ width: '150px', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }} placeholder="Enter Version ID" />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ marginBottom: '8px', color: '#333', fontSize: '14px' }}>Available Versions:</h3>
          {loadingVersions ? <div style={{ color: '#666', fontStyle: 'italic' }}>Loading versions...</div> : (
            <div style={{ maxHeight: '250px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead><tr style={{ background: '#4C7EFF', position: 'sticky', top: 0, color: 'white' }}>
                  {['ID','Name','Comment','Active','Locked','Created'].map(h => <th key={h} style={{ padding: '8px', borderBottom: '2px solid #dee2e6', textAlign: 'center' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {versions.map((v, idx) => (
                    <tr key={v.VersionID} style={{ background: v.VersionID === parseInt(versionId, 10) ? '#e3f2fd' : (idx % 2 === 0 ? '#fff' : '#f8f9fa'), cursor: 'pointer' }} onClick={() => setVersionId(String(v.VersionID))}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6', fontWeight: v.IsActive ? 'bold' : 'normal', textAlign: 'center' }}>{v.VersionID}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>{v.VersionName}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{v.Comment}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>{v.IsActive ? '✓' : ''}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>{v.IsLocked ? '🔒' : ''}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #dee2e6', fontSize: '11px', textAlign: 'center' }}>{v.CreatedOnUTC ? new Date(v.CreatedOnUTC).toLocaleDateString() : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '4px', background: '#6c757d', color: 'white', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
          {!success && <button onClick={handleActivate} disabled={loading || !versionId.trim()} style={{ padding: '10px 20px', border: 'none', borderRadius: '4px', background: loading || !versionId.trim() ? '#ccc' : '#28a745', color: 'white', cursor: loading || !versionId.trim() ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}>{loading ? 'Activating...' : 'Activate'}</button>}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [queryText, setQueryText] = useState('SELECT * FROM ')
  const [queryResults, setQueryResults] = useState(null)
  const [queryError, setQueryError] = useState(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState(null)
  const [activeConfigVersion, setActiveConfigVersion] = useState(null)
  const [activeConfigLoading, setActiveConfigLoading] = useState(false)
  const [activeConfigError, setActiveConfigError] = useState(null)
  const [maxConfigVersion, setMaxConfigVersion] = useState(null)
  const [maxConfigLoading, setMaxConfigLoading] = useState(false)
  const [maxConfigError, setMaxConfigError] = useState(null)
  const [markdownData, setMarkdownData] = useState(null)
  const [markdownLoading, setMarkdownLoading] = useState(false)
  const [markdownError, setMarkdownError] = useState(null)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [showTuneModal, setShowTuneModal] = useState(false)
  const [tuneChangeDecisions, setTuneChangeDecisions] = useState([])
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [dbConfig, setDbConfig] = useState({ server: '', database: '', port: '1433' })
  const [, forceUpdate] = useState(0)
  const markdownTableRef = useRef(null)

  useEffect(() => { checkHealth(); loadConfig(); loadConfigVersions(); loadMarkdownData() }, [])

  const loadConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/config`)
      if (response.data.success) setDbConfig({ server: response.data.server || '', database: response.data.database || '', port: response.data.port || '1433' })
    } catch (error) { console.error('Failed to load config:', error) }
  }

  const checkHealth = async () => {
    try { const response = await axios.get(`${API_BASE_URL}/api/health`); setHealthStatus(response.data) }
    catch (error) { setHealthStatus({ status: 'unhealthy', error: error.message }) }
  }

  const loadConfigVersions = async () => {
    const activeQuery = onLoadQueries.find(q => q.id === 'active-config-version')
    const maxQuery = onLoadQueries.find(q => q.id === 'max-config-version')
    setActiveConfigLoading(true); setMaxConfigLoading(true)
    setActiveConfigError(null); setMaxConfigError(null)
    try {
      const [activeResponse, maxResponse] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/query`, { query: activeQuery.sql, params: activeQuery.params.length > 0 ? activeQuery.params : null }),
        axios.post(`${API_BASE_URL}/api/query`, { query: maxQuery.sql, params: maxQuery.params.length > 0 ? maxQuery.params : null })
      ])
      if (activeResponse.data.success) setActiveConfigVersion(activeResponse.data.data)
      else setActiveConfigError(activeResponse.data.error)
      if (maxResponse.data.success) setMaxConfigVersion(maxResponse.data.data)
      else setMaxConfigError(maxResponse.data.error)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message
      setActiveConfigError(errorMsg); setMaxConfigError(errorMsg)
    } finally { setActiveConfigLoading(false); setMaxConfigLoading(false) }
  }

  const loadMarkdownData = async () => {
    const query = dashboardQueries['current-default-markdowns']
    if (!query) return
    setMarkdownLoading(true); setMarkdownError(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/query/batch`, { query: query.sql, params: null })
      if (response.data.success) setMarkdownData(response.data.data)
      else setMarkdownError(response.data.error)
    } catch (error) {
      if (error.response?.status === 404) setMarkdownError('Batch query endpoint not available.')
      else setMarkdownError(error.response?.data?.detail || error.message)
    } finally { setMarkdownLoading(false) }
  }

  const shouldShowMaxVersion = () => {
    if (!activeConfigVersion || !maxConfigVersion) return false
    if (activeConfigVersion.length === 0 || maxConfigVersion.length === 0) return false
    return activeConfigVersion[0]?.VersionID !== maxConfigVersion[0]?.VersionID
  }

  const isMaxVersionActive = () => {
    if (activeConfigLoading || maxConfigLoading) return false
    if (activeConfigError || maxConfigError) return false
    if (!activeConfigVersion || !maxConfigVersion) return false
    if (activeConfigVersion.length === 0 || maxConfigVersion.length === 0) return false
    return activeConfigVersion[0]?.VersionID === maxConfigVersion[0]?.VersionID
  }

  const executeQuery = async () => {
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE', 'MERGE', 'GRANT', 'REVOKE']
    const queryUpper = queryText.toUpperCase().replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const keyword of dangerousKeywords) {
      const regex = new RegExp('(^|;|\\s)' + keyword + '\\s', 'i')
      if (regex.test(queryUpper)) { setQueryError(`Query blocked: "${keyword}" statements are not allowed.`); return }
    }
    if (!queryUpper.trim().startsWith('SELECT') && !queryUpper.trim().startsWith('WITH')) { setQueryError('Query blocked: Only SELECT queries (or WITH...SELECT) are allowed.'); return }
    setQueryLoading(true); setQueryError(null); setQueryResults(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/query`, { query: queryText, params: null })
      if (response.data.success) setQueryResults(response.data.data)
      else setQueryError(response.data.error)
    } catch (error) { setQueryError(error.response?.data?.detail || error.message) }
    finally { setQueryLoading(false) }
  }

  const handleCloneSuccess = () => { loadConfigVersions() }
  const handleOpenTuneModal = () => { const decisions = markdownTableRef.current?.getChangeDecisions() || []; setTuneChangeDecisions(decisions); setShowTuneModal(true) }
  const handleTuneSuccess = () => { loadMarkdownData(); markdownTableRef.current?.resetDecisions() }
  const handleMarkSubmitted = async (versionId, ppgClusterIDs) => {
    try { await axios.post(`${API_BASE_URL}/api/tuning-session/mark-submitted`, { VersionID: versionId, PPGClusterIDs: ppgClusterIDs }) }
    catch (err) { console.error('Failed to mark session rows as submitted:', err) }
  }
  const handleActivateSuccess = () => { loadConfigVersions() }

  const renderTable = (data) => {
    if (!data || data.length === 0) return <div className="loading">No results returned.</div>
    const columns = Object.keys(data[0])
    return (
      <table>
        <thead><tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
        <tbody>{data.map((row, idx) => (<tr key={idx}>{columns.map((col) => <td key={col}>{row[col] !== null ? String(row[col]) : 'NULL'}</td>)}</tr>))}</tbody>
      </table>
    )
  }

  const actionButtonStyle = {
    padding: '14px 24px', fontSize: '15px', fontWeight: 'bold',
    background: '#4C7EFF', color: 'white', border: 'none', borderRadius: '6px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '8px', transition: 'background 0.2s'
  }

  // Base style matching Refresh Data button
  const tableActionBtn = { width: 'auto', padding: '8px 16px', fontSize: '14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'normal', border: 'none', color: 'white' }

  const tbl = markdownTableRef.current

  return (
    <div className="app">
      <div className="header" style={{ position: 'relative' }}>
        <h1>Retail Insight | HEB Waste Tuning Dashboard</h1>
        <p>Connected to: hebwmddev-sqlvm.ri-team.net</p>
        <button onClick={() => setShowSettingsModal(true)} style={{ position: 'absolute', top: '10px', right: '10px', width: 'auto', background: '#6c757d', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'normal', transform: 'none', boxShadow: 'none' }}>
          ⚙️ Settings
        </button>
      </div>

      {healthStatus && (
        <div className={`health-status ${healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy'}`}>
          {healthStatus.status === 'healthy' ? `Connected: ${healthStatus.message}` : `Disconnected: ${healthStatus.error || 'API unavailable'}`}
        </div>
      )}

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentConfig={dbConfig} onSave={(newConfig) => setDbConfig(newConfig)} onQueriesUpdated={() => { loadConfigVersions(); loadMarkdownData() }} />

      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>Active Config Version</h2>
        {activeConfigLoading && <div className="loading">Loading active config version...</div>}
        {activeConfigError && <div className="error-message">{activeConfigError}</div>}
        {activeConfigVersion && <div className="results">{renderTable(activeConfigVersion)}</div>}
        {isMaxVersionActive() && <p style={{ marginTop: '12px', color: '#155724', fontSize: '0.9rem', fontStyle: 'italic' }}>Max Config Version is Active</p>}
        {shouldShowMaxVersion() && (
          <>
            <h2 style={{ marginTop: '24px' }}>MAX Config Version (Not Active)</h2>
            {maxConfigLoading && <div className="loading">Loading max config version...</div>}
            {maxConfigError && <div className="error-message">{maxConfigError}</div>}
            {maxConfigVersion && <div className="results">{renderTable(maxConfigVersion)}</div>}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>Current Default Markdowns</h2>
        <MarkdownTable
          ref={markdownTableRef}
          data={markdownData}
          loading={markdownLoading}
          error={markdownError}
          maxConfigVersion={maxConfigVersion}
          activeConfigVersion={activeConfigVersion}
        />
        {!markdownLoading && !markdownError && markdownData && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>

            {/* 1. Refresh Data */}
            <button onClick={loadMarkdownData}
              style={{ ...tableActionBtn, background: '#6c757d' }}>
              Refresh Data
            </button>

            {/* 2. Load Proposed Changes */}
            <button
              onClick={() => { markdownTableRef.current?.handleLoadSession(); forceUpdate(n => n + 1) }}
              disabled={tbl?.sessionLoading}
              style={{ ...tableActionBtn, background: tbl?.sessionLoading ? '#ccc' : '#4C7EFF', cursor: tbl?.sessionLoading ? 'not-allowed' : 'pointer' }}>
              {tbl?.sessionLoading ? 'Loading...' : 'Load Proposed Changes'}
            </button>

            {/* 3. Save Session */}
            <button
              onClick={() => { markdownTableRef.current?.handleSaveSession(); forceUpdate(n => n + 1) }}
              disabled={tbl?.sessionSaving}
              style={{ ...tableActionBtn, background: tbl?.sessionSaving ? '#ccc' : '#28a745', cursor: tbl?.sessionSaving ? 'not-allowed' : 'pointer' }}>
              {tbl?.sessionSaving ? 'Saving...' : 'Save Session'}
            </button>

            {/* 4. Reset Unsaved Session Changes */}
            <button
              onClick={() => markdownTableRef.current?.resetDecisions()}
              style={{ ...tableActionBtn, background: '#6c757d' }}>
              Reset Unsaved Session Changes
            </button>

            {/* 5. Reset ALL Planned Changes */}
            <button
              onClick={() => { markdownTableRef.current?.handleResetAll(); forceUpdate(n => n + 1) }}
              disabled={tbl?.sessionResetting}
              style={{ ...tableActionBtn, background: tbl?.sessionResetting ? '#ccc' : '#dc3545', cursor: tbl?.sessionResetting ? 'not-allowed' : 'pointer' }}>
              {tbl?.sessionResetting ? 'Resetting...' : 'Reset ALL Planned Changes'}
            </button>

          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>Tuning Actions</h2>
        <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>Common operations for managing config versions and tuning parameters.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <button onClick={() => setShowCloneModal(true)} style={actionButtonStyle} onMouseOver={(e) => e.target.style.background = '#3a5ecc'} onMouseOut={(e) => e.target.style.background = '#4C7EFF'}>Clone Config Version</button>
          <button onClick={handleOpenTuneModal} style={actionButtonStyle} onMouseOver={(e) => e.target.style.background = '#3a5ecc'} onMouseOut={(e) => e.target.style.background = '#4C7EFF'}>Tune Default Percentages</button>
          <button onClick={() => setShowActivateModal(true)} style={actionButtonStyle} onMouseOver={(e) => e.target.style.background = '#3a5ecc'} onMouseOut={(e) => e.target.style.background = '#4C7EFF'}>Activate Config Version</button>
        </div>
      </div>

      <CloneConfigModal isOpen={showCloneModal} onClose={() => setShowCloneModal(false)} activeVersion={activeConfigVersion} onSuccess={handleCloneSuccess} />
      <TuneDefaultPercentagesModal isOpen={showTuneModal} onClose={() => setShowTuneModal(false)} changeDecisions={tuneChangeDecisions} maxVersion={maxConfigVersion} activeVersion={activeConfigVersion} onSuccess={handleTuneSuccess} onMarkSubmitted={handleMarkSubmitted} />
      <ActivateConfigModal isOpen={showActivateModal} onClose={() => setShowActivateModal(false)} maxVersion={maxConfigVersion} onSuccess={handleActivateSuccess} />

      <div className="dashboard">
        <div className="card">
          <h2>Execute Query (SELECT)</h2>
          <div className="form-group">
            <label>SQL Query:</label>
            <textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="SELECT * FROM table_name WHERE id = ?" />
          </div>
          <button onClick={executeQuery} disabled={queryLoading}>{queryLoading ? 'Executing...' : 'Run Query'}</button>
          {queryError && <div className="error-message">{queryError}</div>}
          {queryResults && (<div className="results"><p><strong>{queryResults.length} row(s) returned</strong></p>{renderTable(queryResults)}</div>)}
        </div>
        <div className="card">
          <h2>Quick Examples</h2>
          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
            <code style={{ display: 'block', marginBottom: '8px' }}>SELECT * FROM [WASTE_HEB].[config].[ConfigVersions]</code>
            <code style={{ display: 'block' }}>SELECT TOP 10 * FROM [WASTE_HEB].wmd.ScalarFinalPercentage</code>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
