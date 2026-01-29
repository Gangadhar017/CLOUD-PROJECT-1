-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create partitions for submissions
CREATE TABLE IF NOT EXISTS submissions_partitioned (
    LIKE submissions INCLUDING ALL
) PARTITION BY RANGE (submitted_at);

-- Create monthly partitions
CREATE TABLE submissions_y2024m01 PARTITION OF submissions_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE submissions_y2024m02 PARTITION OF submissions_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Create partitions for audit logs
CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
    LIKE audit_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Create indexes for performance
CREATE INDEX idx_submissions_contest_verdict ON submissions(contest_id, verdict);
CREATE INDEX idx_submissions_user_contest ON submissions(user_id, contest_id);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Set up auto-increment for partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name TEXT,
    year INT,
    month INT
) RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := table_name || '_y' || year || 'm' || LPAD(month::TEXT, 2, '0');
    start_date := MAKE_DATE(year, month, 1);
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        table_name,
        start_date,
        end_date
    );
END;
$$ LANGUAGE plpgsql;
