-- Aggregate-only production audit; no customer identifiers or payment payloads.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';
SELECT now() AS captured_at;
SELECT CASE WHEN created_at >= now()-interval '30 days' THEN 'last30' ELSE 'previous30' END AS period,
 provider, status, plan_code, count(*) AS orders, count(DISTINCT user_id) AS users, sum(amount) AS amount
FROM payment_orders WHERE created_at >= now()-interval '60 days' GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;
SELECT status, count(*) AS orders, sum(amount) AS amount, min(created_at), max(created_at)
FROM payment_orders GROUP BY status;
SELECT CASE WHEN started_at >= now()-interval '30 days' THEN 'last30' ELSE 'previous30' END AS period,
 status, count(*) AS sessions, count(DISTINCT user_id) AS users
FROM test_sessions s JOIN users u ON u.id=s.user_id
WHERE started_at >= now()-interval '60 days' AND NOT u.is_admin GROUP BY 1,2;
SELECT count(*) AS visits, count(DISTINCT visitor_id) AS visitors, count(DISTINCT user_id) AS linked_users,
count(*) FILTER (WHERE source IS NOT NULL) AS sourced_visits
FROM visit_events WHERE created_at>=now()-interval '30 days';
SELECT fs.step, count(*) AS events, count(DISTINCT v.visitor_id) AS visitors, count(DISTINCT v.user_id) AS users
FROM funnel_steps fs JOIN visit_events v ON v.id=fs.visit_id
WHERE fs.timestamp>=now()-interval '30 days' GROUP BY fs.step ORDER BY events DESC;
SELECT coalesce(source,'unknown') AS source, count(DISTINCT visitor_id) AS visitors
FROM visit_events WHERE created_at>=now()-interval '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 15;
SELECT count(*) AS new_users FROM users WHERE created_at>=now()-interval '30 days' AND NOT is_admin;
SELECT status,count(*) FROM leads WHERE created_at>=now()-interval '30 days' GROUP BY status;
COMMIT;
