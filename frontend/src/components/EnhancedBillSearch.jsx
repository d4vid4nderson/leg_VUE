// components/EnhancedBillSearch.jsx
import React, { useState, useEffect } from 'react';
import EnhancedLegiScanService from '../services/enhancedLegiScanService';

const EnhancedBillSearch = () => {
  const [query, setQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [integrationStatus, setIntegrationStatus] = useState(null);

  const service = new EnhancedLegiScanService();

  const states = [
    { name: 'All States', value: '' },
    { name: 'California', value: 'CA' },
    { name: 'New York', value: 'NY' },
    { name: 'Texas', value: 'TX' },
    { name: 'Florida', value: 'FL' },
    { name: 'Colorado', value: 'CO' },
    { name: 'Kentucky', value: 'KY' },
    { name: 'Nevada', value: 'NV' },
    { name: 'South Carolina', value: 'SC' }
  ];

  // Check integration status on component mount
  useEffect(() => {
    checkIntegrationStatus();
  }, []);

  const checkIntegrationStatus = async () => {
    const result = await service.testIntegration();
    setIntegrationStatus(result);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const result = await service.searchAndAnalyze({
        query: query.trim(),
        state: selectedState || null,
        limit: parseInt(limit),
        saveToDb: true
      });

      if (result.success) {
        setResults(result.data);
        setError(null);
      } else {
        setError(result.error || 'Search failed');
        setResults(null);
      }
    } catch (err) {
      setError(`Search error: ${err.message}`);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const renderIntegrationStatus = () => {
    if (!integrationStatus) return null;

    return (
      <div className={`p-4 mb-4 rounded-lg ${
        integrationStatus.success && integrationStatus.data?.ready_for_production 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <h3 className="font-semibold mb-2">
          {integrationStatus.success ? '✅ System Status' : '❌ System Issues'}
        </h3>
        {integrationStatus.success ? (
          <div className="text-sm">
            <div className="mb-1">
              <strong>LegiScan API:</strong> {integrationStatus.data?.components?.legiscan_api?.status || 'Unknown'}
            </div>
            <div className="mb-1">
              <strong>Azure AI:</strong> {integrationStatus.data?.components?.azure_ai?.status || 'Unknown'}
            </div>
            <div className="mb-1">
              <strong>Pipeline:</strong> {integrationStatus.data?.components?.pipeline?.status || 'Unknown'}
            </div>
          </div>
        ) : (
          <div className="text-red-600">
            {integrationStatus.error || 'Integration test failed'}
          </div>
        )}
      </div>
    );
  };

  const renderSearchResults = () => {
    if (!results) return null;

    return (
      <div className="mt-6">
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">📊 Search Results Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium">Bills Found</div>
              <div className="text-lg">{results.bills_found || 0}</div>
            </div>
            <div>
              <div className="font-medium">Bills Analyzed</div>
              <div className="text-lg">{results.bills_analyzed || 0}</div>
            </div>
            <div>
              <div className="font-medium">Bills Saved</div>
              <div className="text-lg">{results.bills_saved || 0}</div>
            </div>
          </div>
        </div>

        {results.results && results.results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Bills Found ({results.results.length})</h3>
            {results.results.map((bill, index) => (
              <div key={bill.bill_id || index} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-lg font-semibold text-blue-600">
                      {bill.bill_number} - {bill.title || 'No Title'}
                    </h4>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">State:</span> {bill.state} | 
                      <span className="font-medium ml-2">Category:</span> {bill.category || 'Uncategorized'}
                      {bill.search_relevance && (
                        <>
                          <span className="font-medium ml-2">Relevance:</span> {bill.search_relevance}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {bill.description && (
                  <div className="mb-3">
                    <h5 className="font-medium text-gray-700 mb-1">Description:</h5>
                    <p className="text-gray-600 text-sm">{bill.description}</p>
                  </div>
                )}

                {bill.ai_summary && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg mb-3">
                    <h5 className="font-medium text-purple-700 mb-2">🤖 AI Summary:</h5>
                    <div 
                      className="text-sm text-gray-700"
                      dangerouslySetInnerHTML={{ __html: bill.ai_summary }}
                    />
                  </div>
                )}

                {bill.ai_talking_points && (
                  <div className="bg-green-50 p-3 rounded-lg mb-3">
                    <h5 className="font-medium text-green-700 mb-2">💡 Key Talking Points:</h5>
                    <div 
                      className="text-sm text-gray-700"
                      dangerouslySetInnerHTML={{ __html: bill.ai_talking_points }}
                    />
                  </div>
                )}

                {bill.ai_business_impact && (
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <h5 className="font-medium text-orange-700 mb-2">📈 Business Impact:</h5>
                    <div 
                      className="text-sm text-gray-700"
                      dangerouslySetInnerHTML={{ __html: bill.ai_business_impact }}
                    />
                  </div>
                )}

                {bill.url && (
                  <div className="mt-3 pt-3 border-t">
                    <a 
                      href={bill.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      📄 View Full Bill →
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {results.results && results.results.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No bills found for your search query.</p>
            <p className="text-sm mt-2">Try different keywords or search all states.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🔍 Enhanced Bill Search with AI Analysis
        </h1>
        <p className="text-gray-600">
          Search for legislation by topic and get AI-powered analysis including summaries, 
          key points, and business impact assessment.
        </p>
      </div>

      {renderIntegrationStatus()}

      <form onSubmit={handleSearch} className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
              Search Query *
            </label>
            <input
              type="text"
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., healthcare, education, environment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-2">
              Results Limit
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5 bills</option>
              <option value={10}>10 bills</option>
              <option value={20}>20 bills</option>
              <option value={50}>50 bills</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
            State Filter
          </label>
          <select
            id="state"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {states.map(state => (
              <option key={state.value} value={state.value}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className={`w-full py-3 px-4 rounded-md font-medium ${
            loading || !query.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Searching & Analyzing...
            </span>
          ) : (
            '🔍 Search Bills with AI Analysis'
          )}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="text-red-600">
              <h3 className="text-sm font-medium">Error</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {renderSearchResults()}
    </div>
  );
};

export default EnhancedBillSearch;