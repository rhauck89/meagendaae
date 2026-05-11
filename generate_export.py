
import os
import json
import subprocess

tables = [
    "companies", "profiles", "user_roles", "collaborators", "services", 
    "service_professionals", "clients", "appointments", "appointment_services", 
    "business_hours", "blocked_times", "appointment_requests", "client_cashback", 
    "cashback_transactions", "promotions", "promotion_bookings", "promotion_campaigns"
]

def get_data(table):
    cmd = ["psql", "-t", "-A", "-c", f"SELECT json_agg(t) FROM (SELECT * FROM public.{table}) t;"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0 and result.stdout.strip():
        try:
            return json.loads(result.stdout.strip())
        except:
            return []
    return []

def format_value(v):
    if v is None:
        return "NULL"
    if isinstance(v, (dict, list)):
        return f"'{json.dumps(v)}'::jsonb"
    if isinstance(v, str):
        return "'" + v.replace("'", "''") + "'"
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)

output_dir = "public/migration_backup"
os.makedirs(output_dir, exist_ok=True)
output_file = os.path.join(output_dir, "data_export.sql")

with open(output_file, "w") as f:
    f.write("BEGIN;\n\n")
    f.write("-- Disable triggers temporarily to avoid issues with foreign keys during bulk insert if needed\n")
    f.write("-- SET session_replication_role = 'replica';\n\n")
    
    for table in tables:
        data = get_data(table)
        if not data:
            f.write(f"-- No data for {table}\n")
            continue
        
        f.write(f"-- Dumping {len(data)} rows for {table}\n")
        columns = list(data[0].keys())
        col_names = ", ".join(columns)
        
        for row in data:
            values = [format_value(row[col]) for col in columns]
            val_str = ", ".join(values)
            f.write(f"INSERT INTO public.{table} ({col_names}) VALUES ({val_str}) ON CONFLICT DO NOTHING;\n")
        f.write("\n")
    
    f.write("\n-- Users List for reference (cannot easily INSERT into auth.users directly)\n")
    cmd_users = ["psql", "-t", "-A", "-c", "SELECT json_agg(t) FROM (SELECT id, email, raw_user_meta_data FROM auth.users) t;"]
    result_users = subprocess.run(cmd_users, capture_output=True, text=True)
    if result_users.returncode == 0 and result_users.stdout.strip():
        try:
            users = json.loads(result_users.stdout.strip())
            f.write("/*\nLISTA DE USUÁRIOS PARA RECRIAR:\n")
            for u in users:
                f.write(f"ID: {u['id']}, Email: {u['email']}, Meta: {json.dumps(u['raw_user_meta_data'])}\n")
            f.write("*/\n")
        except:
            pass

    f.write("\nCOMMIT;\n")

print(f"Export completed: {output_file}")
