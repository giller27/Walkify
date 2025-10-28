import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'bootstrap/dist/css/bootstrap.css'

import { GoogleOAuthProvider } from '@react-oauth/google'

const CLIENT_ID = "1018401887471-ltpjg1ss448evlj6l8erb1902adpd8tr.apps.googleusercontent.com"

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
    <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
