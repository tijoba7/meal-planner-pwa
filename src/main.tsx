import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { queryClient } from './lib/queryClient'
import { initSentry } from './lib/sentry'
import { startVitalsReporting } from './lib/vitals'
import { migrateBrandKeys } from './lib/brandMigration'
import './index.css'

migrateBrandKeys()
initSentry()
startVitalsReporting()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
