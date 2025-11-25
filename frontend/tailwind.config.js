module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Custom dark mode colors
        dark: {
          bg: '#0f172a',        // slate-900
          'bg-secondary': '#1e293b', // slate-800
          'bg-tertiary': '#334155',  // slate-700
          text: '#f1f5f9',      // slate-100
          'text-secondary': '#cbd5e1', // slate-300
          border: '#475569',    // slate-600
        }
      }
    }
  },
  plugins: []
} 
