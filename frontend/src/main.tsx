import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log("React app is starting...");

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log("React app rendered successfully.");
} catch (e) {
  console.error("Error rendering React app:", e);
  document.getElementById('root')!.innerHTML = `<div style="color: red; padding: 20px;"><h1>Erreur de rendu</h1><pre>${e}</pre></div>`;
}

