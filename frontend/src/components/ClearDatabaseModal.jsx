// Add these additional imports to your existing imports
import {
  Settings,
  Info,
  RotateCw,
  CheckCircle,
  X,
  Trash2,
  ChevronDown,
  HelpCircle,
  ExternalLink,
  Mail,
  Monitor,
  Shield,
  Globe,
  Database,
  Edit3,
  Save,
  AlertTriangle,  // NEW
  Eye,           // NEW
  EyeOff         // NEW
} from 'lucide-react';

// Add these new state variables to your existing useState declarations
const [showDatabaseModal, setShowDatabaseModal] = useState(false);
const [passwordInput, setPasswordInput] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [passwordError, setPasswordError] = useState('');

// Set your required password here (you can move this to environment variables later)
const REQUIRED_PASSWORD = "DELETE_DATABASE_2024"; // Change this to whatever password you want

// Update your handleClearDatabase function
const handleClearDatabase = async () => {
  if (clearingDatabase) return;
  
  // Check password
  if (passwordInput !== REQUIRED_PASSWORD) {
    setPasswordError('Incorrect password. Please try again.');
    return;
  }
  
  setClearingDatabase(true);
  setClearStatus('🗑️ Clearing database...');
  setShowDatabaseModal(false); // Close modal
  setPasswordInput(''); // Clear password
  setPasswordError(''); // Clear any errors
  
  try {
    const response = await fetch(`${API_URL}/api/database/clear-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      setClearStatus('✅ Database cleared successfully!');
      setShowClearWarning(false);
      setTimeout(checkAllIntegrations, 2000);
    } else {
      const errorData = await response.json();
      setClearStatus(`❌ Error: ${errorData.message || 'Failed to clear database'}`);
    }
    
  } catch (error) {
    console.error('Error clearing database:', error);
    setClearStatus(`❌ Error: ${error.message}`);
  } finally {
    setClearingDatabase(false);
    setTimeout(() => setClearStatus(null), 5000);
  }
};

// Function to open the modal
const openDatabaseModal = () => {
  setShowDatabaseModal(true);
  setPasswordInput('');
  setPasswordError('');
  setShowPassword(false);
};

// Function to close the modal
const closeDatabaseModal = () => {
  setShowDatabaseModal(false);
  setPasswordInput('');
  setPasswordError('');
  setShowPassword(false);
};

// Modal Component (add this before your return statement)
const DatabaseClearModal = () => {
  if (!showDatabaseModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Clear Database</h3>
          </div>
          <button
            onClick={closeDatabaseModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <div className="mb-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <h4 className="font-semibold text-red-800 mb-2">⚠️ Warning: This action cannot be undone</h4>
              <p className="text-red-700 text-sm mb-2">
                Deleting the database will permanently remove:
              </p>
              <ul className="text-red-700 text-sm space-y-1 ml-4">
                <li>• All executive orders and state legislation</li>
                <li>• AI analysis and summaries</li>
                <li>• Your highlighted items and bookmarks</li>
                <li>• All cached data and preferences</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
              <h4 className="font-semibold text-yellow-800 mb-2">📊 Data Recovery Notice</h4>
              <p className="text-yellow-700 text-sm">
                When data is re-fetched from external APIs, the information you get back 
                might not be exactly the same as before due to:
              </p>
              <ul className="text-yellow-700 text-sm space-y-1 ml-4 mt-2">
                <li>• Updates to federal regulations</li>
                <li>• Changes in state legislation</li>
                <li>• API modifications or data source updates</li>
                <li>• Different AI analysis results</li>
              </ul>
            </div>
          </div>

          {/* Password Input */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Enter password to confirm deletion:
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (passwordError) setPasswordError(''); // Clear error when typing
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleClearDatabase();
                  }
                }}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  passwordError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter required password..."
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordError && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <X size={14} />
                {passwordError}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={closeDatabaseModal}
              disabled={clearingDatabase}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleClearDatabase}
              disabled={clearingDatabase || !passwordInput.trim()}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                clearingDatabase || !passwordInput.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <Trash2 size={14} />
              {clearingDatabase ? 'Clearing...' : 'Clear Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Update your Database Management section to use the modal
// Replace the existing clear database button with this:

{!showClearWarning ? (
  <button
    onClick={openDatabaseModal}  // Changed from setShowClearWarning(true)
    disabled={clearingDatabase}
    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
      clearingDatabase 
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
        : 'bg-red-600 text-white hover:bg-red-700'
    }`}
  >
    Clear Database
  </button>
) : (
  // Remove this entire section since we're using a modal now
  <div className="flex gap-2">
    <button
      onClick={() => setShowClearWarning(false)}
      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400 transition-all duration-300"
    >
      Cancel
    </button>
  </div>
)}

// Add the modal component to your JSX return statement, right before the closing </div>:

return (
  <div className="pt-6">
    {/* ... all your existing content ... */}
    
    {/* Add the modal component here, just before the closing div */}
    <DatabaseClearModal />
  </div>
);