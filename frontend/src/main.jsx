import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from "./app.routes.jsx";
import App from './App.jsx';
import "./style.scss";
import './styles/button.scss';
import { AuthProvider } from "./features/auth/auth.context.jsx";


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
 
  
    
);
