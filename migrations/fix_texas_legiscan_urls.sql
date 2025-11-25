-- Migration: Fix Texas 89th Legislature 2nd Special Session LegiScan URLs
-- Date: 2025-01-12
-- Description: Populate missing legiscan_url values for Texas bills in the
--              89th Legislature 2nd Special Session
--
-- Issue: Bills in the 2nd Special Session (Aug 2025) were missing legiscan_url
--        values, causing "View Original Bill Information" links to not appear
--        on the frontend.
--
-- Solution: Update legiscan_url with the correct LegiScan URL pattern for
--           2nd Special Session bills.

-- Update legiscan_url for 89th Legislature 2nd Special Session bills
UPDATE dbo.state_legislation
SET legiscan_url = 'https://legiscan.com/TX/bill/' + bill_number + '/2025/X2'
WHERE state = 'TX'
  AND session_name = '89th Legislature 2nd Special Session'
  AND (legiscan_url IS NULL OR legiscan_url = '');

-- Expected result: ~120 bills updated
-- Verification query:
-- SELECT COUNT(*) FROM dbo.state_legislation
-- WHERE state = 'TX'
--   AND session_name = '89th Legislature 2nd Special Session'
--   AND legiscan_url IS NOT NULL;
