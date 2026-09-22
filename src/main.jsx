import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Capture from './Capture.jsx';
import './styles/index.css';

// The capture window loads the same bundle with #capture, so there is one
// renderer build and one preload.
const isCapture = window.location.hash === '#capture';

// No StrictMode: its deliberate double-invocation would fire every startup IPC
// call twice in dev for no benefit here.
createRoot(document.getElementById('root')).render(isCapture ? <Capture /> : <App />);
