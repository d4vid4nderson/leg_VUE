// =====================================
// SHIMMER LOADING COMPONENT
// =====================================
import React from 'react';

// Reusable Shimmer Animation Component
const ShimmerLoading = ({ 
  title = "Loading", 
  description = "Please wait while we fetch the data...",
  showCards = true,
  cardCount = 3
}) => {
  return (
    <div className="py-12">
      {/* Header Shimmer */}
      <div className="text-center mb-8">
        <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-lg w-64 mx-auto mb-4 animate-shimmer bg-size-200"></div>
        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-96 mx-auto animate-shimmer bg-size-200"></div>
      </div>

      {/* Card Shimmer Placeholders */}
      {showCards && (
        <div className="space-y-6">
          {Array.from({ length: cardCount }, (_, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* Title shimmer */}
              <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-3/4 mb-4 animate-shimmer bg-size-200"></div>
              
              {/* Metadata shimmer */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-24 animate-shimmer bg-size-200"></div>
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-32 animate-shimmer bg-size-200"></div>
                <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-full w-20 animate-shimmer bg-size-200"></div>
                <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-full w-16 animate-shimmer bg-size-200"></div>
              </div>
              
              {/* Content shimmer */}
              <div className="space-y-3">
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-full animate-shimmer bg-size-200"></div>
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-5/6 animate-shimmer bg-size-200"></div>
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-4/5 animate-shimmer bg-size-200"></div>
              </div>
              
              {/* Action buttons shimmer */}
              <div className="flex gap-2 mt-6">
                <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-24 animate-shimmer bg-size-200"></div>
                <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-20 animate-shimmer bg-size-200"></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================
// CSS STYLES FOR SHIMMER ANIMATION
// =====================================
// Add this to your CSS file (index.css or App.css):

const shimmerStyles = `
/* Shimmer animation keyframes */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Shimmer animation class */
.animate-shimmer {
  animation: shimmer 2s ease-in-out infinite;
  background-size: 200% 100%;
}

/* Background size utility for shimmer */
.bg-size-200 {
  background-size: 200% 100%;
}
`;

// =====================================
// USAGE IN EXECUTIVE ORDERS PAGE
// =====================================
// Replace the existing loading animation in ExecutiveOrdersPage.jsx:

// BEFORE:
/*
{loading ? (
  <div className="py-12 text-center">
    <div className="mb-6 relative">
      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
        <Database size={32} className="text-white" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-400 rounded-full animate-ping opacity-30"></div>
      </div>
    </div>
    <h3 className="text-lg font-bold text-gray-800 mb-2">Loading from Database</h3>
    <p className="text-gray-600">Fetching processed executive orders...</p>
  </div>
) :
*/

// AFTER:
const ExecutiveOrdersLoadingState = () => (
  <ShimmerLoading 
    title="Loading Executive Orders"
    description="Fetching processed executive orders from database..."
    showCards={true}
    cardCount={4}
  />
);

// Usage in render:
// {loading ? <ExecutiveOrdersLoadingState /> : /* your content */}

// =====================================
// USAGE IN STATE PAGE
// =====================================
// Replace the existing loading animation in StatePage.jsx:

// BEFORE:
/*
{stateLoading ? (
  <div className="py-12 text-center">
    <div className="mb-6 relative">
      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
        <FileText size={32} className="text-white" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-400 rounded-full animate-ping opacity-30"></div>
      </div>
    </div>
    <h3 className="text-lg font-bold text-gray-800 mb-2">Loading {stateName} Legislation</h3>
    <p className="text-gray-600">Please wait while we fetch the data...</p>
  </div>
) :
*/

// AFTER:
const StatePageLoadingState = ({ stateName }) => (
  <ShimmerLoading 
    title={`Loading ${stateName} Legislation`}
    description="Please wait while we fetch the latest state legislation..."
    showCards={true}
    cardCount={3}
  />
);

// Usage in render:
// {stateLoading ? <StatePageLoadingState stateName={stateName} /> : /* your content */}

// =====================================
// USAGE IN HIGHLIGHTS PAGE
// =====================================
// Replace the existing loading animation in HighlightsPage.jsx:

// BEFORE:
/*
if (loading) {
  return (
    <div className="pt-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
        <p className="text-gray-600">Your saved executive orders and legislation with AI analysis.</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-2 text-gray-600">Please be patient, our AI is working hard to load your highlights...</span>
      </div>
    </div>
  );
}
*/

// AFTER:
const HighlightsLoadingState = () => (
  <div className="pt-6">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
      <p className="text-gray-600">Your saved executive orders and legislation with AI analysis.</p>
    </div>
    <ShimmerLoading 
      title="Loading Your Highlights"
      description="Please be patient, our AI is working hard to load your highlights..."
      showCards={true}
      cardCount={5}
    />
  </div>
);

// Usage in render:
// if (loading) {
//   return <HighlightsLoadingState />;
// }

// =====================================
// ALTERNATIVE: MINIMAL SHIMMER CARDS
// =====================================
// For a more compact version, you can create simplified shimmer cards:

const MinimalShimmerCard = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-3/4 mb-3 animate-shimmer bg-size-200"></div>
    <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-1/2 mb-3 animate-shimmer bg-size-200"></div>
    <div className="space-y-2">
      <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-full animate-shimmer bg-size-200"></div>
      <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-4/5 animate-shimmer bg-size-200"></div>
    </div>
  </div>
);

const MinimalShimmerLoading = ({ count = 4 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }, (_, index) => (
      <MinimalShimmerCard key={index} />
    ))}
  </div>
);

export default ShimmerLoading;