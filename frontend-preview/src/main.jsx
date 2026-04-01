import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Note: StrictMode removed to prevent double-execution of queries in development
// StrictMode intentionally runs effects twice to catch bugs, but for a dashboard
// with expensive SQL queries, this causes unnecessary load on the database.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
