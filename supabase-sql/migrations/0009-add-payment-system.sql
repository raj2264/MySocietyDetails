-- Migration: Add Payment System with Razorpay Integration
-- Description: Sets up tables and functions for managing Razorpay payments
-- Author: Claude
-- Date: 2024

-- Create table for storing Razorpay account details for societies
CREATE TABLE IF NOT EXISTS razorpay_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL UNIQUE, -- Razorpay Account ID
    key_id TEXT NOT NULL, -- Razorpay Key ID
    key_secret TEXT NOT NULL, -- Razorpay Key Secret (encrypted)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(society_id)
);

-- Create table for storing payment records
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    bill_id UUID REFERENCES maintenance_bills(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    razorpay_signature TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method TEXT,
    payment_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2),
    refund_reason TEXT
);

-- Add RLS policies for razorpay_accounts
ALTER TABLE razorpay_accounts ENABLE ROW LEVEL SECURITY;

-- Superadmins can manage all Razorpay accounts
CREATE POLICY "Superadmins can manage Razorpay accounts"
ON razorpay_accounts
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM superadmins
        WHERE id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM superadmins
        WHERE id = auth.uid()
    )
);

-- Add RLS policies for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Residents can view their own payments
CREATE POLICY "Residents can view their own payments"
ON payments
FOR SELECT
USING (
    resident_id IN (
        SELECT id FROM residents
        WHERE user_id = auth.uid()
    )
);

-- Society admins can view payments for their society
CREATE POLICY "Society admins can view society payments"
ON payments
FOR SELECT
USING (
    society_id IN (
        SELECT society_id FROM society_admins
        WHERE user_id = auth.uid()
    )
);

-- Superadmins can view all payments
CREATE POLICY "Superadmins can view all payments"
ON payments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM superadmins
        WHERE id = auth.uid()
    )
);

-- Grant necessary permissions
GRANT SELECT ON razorpay_accounts TO authenticated;
GRANT ALL ON razorpay_accounts TO service_role;
GRANT SELECT ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

-- Function to create a new Razorpay account for a society
CREATE OR REPLACE FUNCTION create_razorpay_account(
    p_society_id UUID,
    p_account_id TEXT,
    p_key_id TEXT,
    p_key_secret TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_is_superadmin BOOLEAN;
BEGIN
    -- Check if user is superadmin
    SELECT EXISTS (
        SELECT 1 FROM superadmins
        WHERE id = auth.uid()
    ) INTO v_is_superadmin;

    IF NOT v_is_superadmin THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Only superadmins can create Razorpay accounts'
        );
    END IF;

    -- Check if society already has a Razorpay account
    IF EXISTS (
        SELECT 1 FROM razorpay_accounts
        WHERE society_id = p_society_id
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Society already has a Razorpay account'
        );
    END IF;

    -- Insert new Razorpay account
    INSERT INTO razorpay_accounts (
        society_id,
        account_id,
        key_id,
        key_secret,
        created_by
    ) VALUES (
        p_society_id,
        p_account_id,
        p_key_id,
        p_key_secret,
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Razorpay account created successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a payment order
CREATE OR REPLACE FUNCTION create_payment_order(
    p_bill_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_bill maintenance_bills;
    v_resident residents;
    v_society societies;
    v_razorpay_account razorpay_accounts;
    v_payment_id UUID;
    v_order_id TEXT;
BEGIN
    -- Get bill details
    SELECT * INTO v_bill
    FROM maintenance_bills
    WHERE id = p_bill_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Bill not found'
        );
    END IF;

    -- Get resident details
    SELECT * INTO v_resident
    FROM residents
    WHERE id = v_bill.resident_id;

    IF NOT FOUND OR v_resident.user_id != auth.uid() THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Unauthorized access to bill'
        );
    END IF;

    -- Get society details
    SELECT * INTO v_society
    FROM societies
    WHERE id = v_bill.society_id;

    -- Get Razorpay account details
    SELECT * INTO v_razorpay_account
    FROM razorpay_accounts
    WHERE society_id = v_society.id AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Society payment gateway not configured'
        );
    END IF;

    -- Create payment record
    INSERT INTO payments (
        society_id,
        resident_id,
        bill_id,
        amount,
        status
    ) VALUES (
        v_society.id,
        v_resident.id,
        v_bill.id,
        v_bill.total_amount,
        'pending'
    ) RETURNING id INTO v_payment_id;

    -- Call Razorpay API to create order (this will be handled by Edge Function)
    -- The Edge Function will update the payment record with order_id
    -- and return the order details to the client

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Payment order created',
        'payment_id', v_payment_id,
        'society_id', v_society.id,
        'amount', v_bill.total_amount,
        'currency', 'INR',
        'key_id', v_razorpay_account.key_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify and complete payment
CREATE OR REPLACE FUNCTION verify_payment(
    p_payment_id UUID,
    p_razorpay_payment_id TEXT,
    p_razorpay_order_id TEXT,
    p_razorpay_signature TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_payment payments;
    v_razorpay_account razorpay_accounts;
BEGIN
    -- Get payment details
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Payment not found'
        );
    END IF;

    -- Get Razorpay account details
    SELECT * INTO v_razorpay_account
    FROM razorpay_accounts
    WHERE society_id = v_payment.society_id AND is_active = true;

    -- Verify payment signature (this will be handled by Edge Function)
    -- The Edge Function will verify the signature and update the payment status

    -- Update payment record
    UPDATE payments
    SET 
        razorpay_payment_id = p_razorpay_payment_id,
        razorpay_order_id = p_razorpay_order_id,
        razorpay_signature = p_razorpay_signature,
        status = 'completed',
        completed_at = NOW(),
        payment_method = 'razorpay',
        payment_details = jsonb_build_object(
            'razorpay_payment_id', p_razorpay_payment_id,
            'razorpay_order_id', p_razorpay_order_id
        )
    WHERE id = p_payment_id;

    -- Update bill status
    UPDATE maintenance_bills
    SET status = 'paid'
    WHERE id = v_payment.bill_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Payment verified and completed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initiate refund
CREATE OR REPLACE FUNCTION initiate_refund(
    p_payment_id UUID,
    p_refund_amount DECIMAL(10,2),
    p_refund_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_payment payments;
    v_razorpay_account razorpay_accounts;
    v_is_admin BOOLEAN;
BEGIN
    -- Get payment details
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Payment not found'
        );
    END IF;

    -- Check if user is society admin or superadmin
    SELECT EXISTS (
        SELECT 1 FROM society_admins
        WHERE user_id = auth.uid()
        AND society_id = v_payment.society_id
    ) OR EXISTS (
        SELECT 1 FROM superadmins
        WHERE id = auth.uid()
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Unauthorized to initiate refund'
        );
    END IF;

    -- Get Razorpay account details
    SELECT * INTO v_razorpay_account
    FROM razorpay_accounts
    WHERE society_id = v_payment.society_id AND is_active = true;

    -- Initiate refund through Razorpay (this will be handled by Edge Function)
    -- The Edge Function will process the refund and update the payment status

    -- Update payment record
    UPDATE payments
    SET 
        status = 'refunded',
        refunded_at = NOW(),
        refund_amount = p_refund_amount,
        refund_reason = p_refund_reason
    WHERE id = p_payment_id;

    -- Update bill status
    UPDATE maintenance_bills
    SET status = 'refunded'
    WHERE id = v_payment.bill_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Refund initiated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC endpoints
CREATE OR REPLACE FUNCTION api_create_razorpay_account(
    society_id UUID,
    account_id TEXT,
    key_id TEXT,
    key_secret TEXT
)
RETURNS JSONB AS $$
BEGIN
    RETURN create_razorpay_account(
        society_id,
        account_id,
        key_id,
        key_secret
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api_create_payment_order(
    bill_id UUID
)
RETURNS JSONB AS $$
BEGIN
    RETURN create_payment_order(bill_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api_verify_payment(
    payment_id UUID,
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    razorpay_signature TEXT
)
RETURNS JSONB AS $$
BEGIN
    RETURN verify_payment(
        payment_id,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api_initiate_refund(
    payment_id UUID,
    refund_amount DECIMAL(10,2),
    refund_reason TEXT
)
RETURNS JSONB AS $$
BEGIN
    RETURN initiate_refund(
        payment_id,
        refund_amount,
        refund_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION api_create_razorpay_account(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api_create_payment_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION api_verify_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api_initiate_refund(UUID, DECIMAL, TEXT) TO authenticated; 