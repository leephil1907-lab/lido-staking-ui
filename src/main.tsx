// Minimal Vite entry that loads the existing app.js
import '/app.js';

const root = document.getElementById('root');
if (!root) {
  console.warn('No #root element found in index.html');
}
