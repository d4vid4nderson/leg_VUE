-- Update all executive orders with 'civic' category to 'not-applicable'
UPDATE executive_orders 
SET category = 'not-applicable'
WHERE category = 'civic';

-- Show the count of updated records
SELECT 'Updated ' || COUNT(*) || ' executive orders from civic to not-applicable' as result
FROM executive_orders
WHERE category = 'not-applicable';

-- Show current category distribution
SELECT category, COUNT(*) as count
FROM executive_orders
GROUP BY category
ORDER BY category;