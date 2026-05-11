import os
import json
import subprocess

def get_data(table):
    cmd = ["psql", "-c", f"SELECT row_to_json(t) FROM (SELECT * FROM public.{table}) t;"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return []
    lines = result.stdout.strip().split('\n')
    data = []
    for line in lines:
        if line.startswith('{"'):
            data.append(json.loads(line))
    return data

def format_val(val):
    if val is None:
        return 'NULL'
    if isinstance(val, (dict, list)):
        return f"'{json.dumps(val)}'"
    if isinstance(val, str):
        # Escape single quotes
        safe_str = val.replace("'", "''")
        return f"'{safe_str}'"
    if isinstance(val, bool):
        return 'true' if val else 'false'
    return str(val)

def generate_inserts(table, data):
    if not data:
        return f"-- No data for {table}\n"
    
    columns = list(data[0].keys())
    cols_str = ", ".join(columns)
    
    sql = f"-- Table: {table}\n"
    for row in data:
        vals = [format_val(row.get(col)) for col in columns]
        vals_str = ", ".join(vals)
        sql += f"INSERT INTO public.{table} ({cols_str}) VALUES ({vals_str}) ON CONFLICT DO NOTHING;\n"
    return sql + "\n"

# Order of tables to respect FKs (rough estimation based on names)
tables = [
    "categories", "subcategories", "amenities", "states", "cities", "brazilian_states", "brazilian_cities",
    "plans", "subscription_plans",
    "companies", "company_settings", "company_modules", "company_amenities", "company_gallery", "company_domains",
    "profiles", "user_roles", "collaborators",
    "service_categories", "services", "service_templates", "service_professionals",
    "clients", "client_companies", "client_cashback", "cashback_transactions",
    "appointments", "appointment_services", "appointment_requests",
    "business_hours", "blocked_times", "professional_working_hours", "business_exceptions",
    "promotions", "promotion_campaigns", "promotion_bookings", "promotion_campaign_logs",
    "loyalty_config", "loyalty_reward_items", "loyalty_redemptions", "loyalty_points_transactions",
    "support_tickets", "support_messages", "support_ticket_messages", "platform_messages",
    "platform_settings", "whatsapp_templates", "whatsapp_automations", "whatsapp_instances"
]

all_sql = "BEGIN;\n\n"
for table in tables:
    print(f"Exporting {table}...")
    data = get_data(table)
    all_sql += generate_inserts(table, data)

all_sql += "COMMIT;"

with open("migration_backup/data_export.sql", "w") as f:
    f.write(all_sql)
