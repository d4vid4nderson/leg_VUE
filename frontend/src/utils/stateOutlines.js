// State outline utilities using embedded state data
import { feature } from 'topojson-client';
import { geoPath, geoAlbersUsa } from 'd3-geo';

// State name to FIPS code mapping for our supported states
const STATE_FIPS_MAP = {
  'California': '06',
  'Colorado': '08',
  'Kentucky': '21',
  'Nevada': '32',
  'South Carolina': '45',
  'Texas': '48'
};

// Cache for us-atlas data
let usAtlasData = null;

// Embedded minimal state data for testing
const MINIMAL_STATE_DATA = {
  type: "Topology",
  objects: {
    states: {
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          id: "06", // California
          coordinates: [[[-124.482003, 32.534156], [-124.482003, 42.009518], [-114.131211, 42.009518], [-114.131211, 32.534156], [-124.482003, 32.534156]]]
        },
        {
          type: "Polygon", 
          id: "48", // Texas
          coordinates: [[[-106.645646, 25.837377], [-106.645646, 36.500704], [-93.508292, 36.500704], [-93.508292, 25.837377], [-106.645646, 25.837377]]]
        }
      ]
    }
  }
};

// Load us-atlas data dynamically
const loadUsAtlasData = async () => {
  if (usAtlasData) return usAtlasData;
  
  try {
    console.log('🗺️ Loading us-atlas data...');
    
    // Try to load from public directory
    try {
      const response = await fetch('/states-10m.json');
      if (response.ok) {
        usAtlasData = await response.json();
        console.log('🗺️ Loaded from public directory successfully');
      } else {
        throw new Error('Fetch failed');
      }
    } catch (error) {
      console.log('🗺️ Using fallback minimal data');
      usAtlasData = MINIMAL_STATE_DATA;
    }
    
    console.log('🗺️ Us-atlas data loaded successfully:', {
      hasObjects: !!usAtlasData?.objects,
      hasStates: !!usAtlasData?.objects?.states,
      type: typeof usAtlasData,
      objectKeys: usAtlasData?.objects ? Object.keys(usAtlasData.objects) : []
    });
    return usAtlasData;
  } catch (error) {
    console.error('🗺️ Error loading us-atlas data:', error);
    // Use fallback data
    usAtlasData = MINIMAL_STATE_DATA;
    return usAtlasData;
  }
};

// Generate SVG path for a specific state
export const generateStateOutline = async (stateName) => {
  try {
    console.log('🗺️ Starting generateStateOutline for:', stateName);
    
    // Get FIPS code for the state
    const fipsCode = STATE_FIPS_MAP[stateName];
    console.log('🗺️ FIPS code for', stateName, ':', fipsCode);
    if (!fipsCode) {
      console.warn(`FIPS code not found for state: ${stateName}`);
      return null;
    }
    
    // Load us-atlas data
    const us = await loadUsAtlasData();
    console.log('🗺️ Atlas data available:', !!us);
    
    // Convert topojson to geojson
    const states = feature(us, us.objects.states);
    console.log('🗺️ States features count:', states.features.length);
    
    // Find the specific state by FIPS code
    const stateFeature = states.features.find(d => d.id === fipsCode);
    if (!stateFeature) {
      console.warn(`State feature not found for FIPS code: ${fipsCode}`);
      return null;
    }
    
    console.log('🗺️ Found state feature for', stateName);
    
    // Create projection and path generator for better centering
    const projection = geoAlbersUsa()
      .scale(1200)
      .translate([500, 300]);
    
    const pathGenerator = geoPath().projection(projection);
    
    // Generate the SVG path
    const pathData = pathGenerator(stateFeature);
    console.log('🗺️ Generated path data length:', pathData ? pathData.length : 0);
    
    // Get the bounds of the path to calculate centering
    const bounds = pathGenerator.bounds(stateFeature);
    const [[x0, y0], [x1, y1]] = bounds;
    const width = x1 - x0;
    const height = y1 - y0;
    const centerX = (x0 + x1) / 2;
    const centerY = (y0 + y1) / 2;
    
    console.log('🗺️ State bounds:', { x0, y0, x1, y1, width, height, centerX, centerY });
    
    return {
      pathData,
      stateName,
      fipsCode,
      bounds: { x0, y0, x1, y1, width, height, centerX, centerY }
    };
    
  } catch (error) {
    console.error('Error generating state outline:', error);
    return null;
  }
};

// Get state outline as SVG path data (for use in React components)
export const getStateOutlinePath = (pathData) => {
  if (!pathData) return null;
  return pathData;
};

// Preload state outlines for better performance
export const preloadStateOutlines = async () => {
  const outlines = {};
  
  for (const stateName of Object.keys(STATE_FIPS_MAP)) {
    try {
      const outline = await generateStateOutline(stateName);
      if (outline) {
        outlines[stateName] = outline;
      }
    } catch (error) {
      console.error(`Failed to preload outline for ${stateName}:`, error);
    }
  }
  
  return outlines;
};