-- Razorpay Account Setup and Cleanup Script
-- Run this in Supabase SQL Editor to fix all issues

-- Step 1: Activate all inactive accounts
UPDATE razorpay_accounts 
SET is_active = true 
WHERE is_active = false;

-- Step 2: Delete duplicate accounts (keep only one per society)
DELETE FROM razorpay_accounts 
WHERE id NOT IN (
  SELECT DISTINCT ON (society_id) id 
  FROM razorpay_accounts 
  ORDER BY society_id, created_at DESC
);

-- Step 3: Update all accounts with your test keys
UPDATE razorpay_accounts 
SET 
  key_id = 'rzp_test_SKlMhy819jKTDn',
  key_secret = 'zLfb1GMqhlW3XTDX44Ja0en7',
  is_active = true,
  updated_at = NOW()
WHERE key_id != 'rzp_test_SKlMhy819jKTDn';

-- Step 4: Add Razorpay to any societies that don't have accounts
INSERT INTO razorpay_accounts (society_id, account_id, key_id, key_secret, is_active)
SELECT 
  s.id,
  'test_account_' || ROW_NUMBER() OVER (ORDER BY s.id),
  'rzp_test_SKlMhy819jKTDn',
  'zLfb1GMqhlW3XTDX44Ja0en7',
  true
FROM societies s
WHERE s.id NOT IN (SELECT DISTINCT society_id FROM razorpay_accounts)
ON CONFLICT (society_id) DO UPDATE SET
  key_id = 'rzp_test_SKlMhy819jKTDn',
  key_secret = 'zLfb1GMqhlW3XTDX44Ja0en7',
  is_active = true;

-- Step 5: Verify everything is correct
SELECT 
  s.name as society_name,
  ra.account_id,
  ra.key_id,
  ra.is_active,
  ra.created_at
FROM razorpay_accounts ra
JOIN societies s ON ra.society_id = s.id
ORDER BY s.name;

-- Step 6: Check for any issues
SELECT 
  'Missing Razorpay Account' as issue,
  COUNT(*) as count
FROM societies s
WHERE s.id NOT IN (SELECT society_id FROM razorpay_accounts WHERE is_active = true)
UNION ALL
SELECT 
  'Inactive Razorpay Account',
  COUNT(*)
FROM razorpay_accounts
WHERE is_active = false
UNION ALL
SELECT 
  'Razorpay Account with wrong keys',
  COUNT(*)
FROM razorpay_accounts
WHERE key_id != 'rzp_test_SKlMhy819jKTDn'
UNION ALL
SELECT 
  'Duplicate Society Accounts',
  COUNT(*) - COUNT(DISTINCT society_id)
FROM razorpay_accounts;
