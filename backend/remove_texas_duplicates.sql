-- Remove duplicate 'Texas' entries, keep only 'TX' entries
-- This will clean up the database to have consistent state abbreviations

-- First, let's see what we're working with
SELECT 'BEFORE CLEANUP' as status;
SELECT state, COUNT(*) as count 
FROM dbo.state_legislation 
WHERE state IN ('Texas', 'TX') 
GROUP BY state 
ORDER BY state;

-- Delete entries where state = 'Texas' (keep TX entries)
DELETE FROM dbo.state_legislation 
WHERE state = 'Texas';

-- Show results after cleanup
SELECT 'AFTER CLEANUP' as status;
SELECT state, COUNT(*) as count 
FROM dbo.state_legislation 
WHERE state IN ('Texas', 'TX') 
GROUP BY state 
ORDER BY state;

-- Show final state distribution
SELECT 'FINAL STATE DISTRIBUTION' as status;
SELECT state, COUNT(*) as count 
FROM dbo.state_legislation 
GROUP BY state 
ORDER BY state;