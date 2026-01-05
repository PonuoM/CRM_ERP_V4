import csv
import os
from datetime import datetime

input_csv = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customer_company1 2 7 - Copy.csv'
output_sql = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_import.sql'

def format_date(date_str):
    if not date_str or date_str.lower() == 'null' or date_str.strip() == '':
        return 'NULL'
    try:
        # CSV formats: 2025/12/15 11:02:38 or 2025-10-20 14:21:27
        date_str = date_str.replace('/', '-')
        dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
        return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"
    except:
        return 'NULL'

def escape_sql(val):
    if val is None or str(val).lower() == 'null' or str(val).strip() == '':
        return 'NULL'
    # Escape single quotes
    safe_val = str(val).replace("'", "''")
    return f"'{safe_val}'"

def convert():
    if not os.path.exists(input_csv):
        print(f"Error: {input_csv} not found")
        return

    with open(input_csv, 'r', encoding='utf-8-sig') as f, open(output_sql, 'w', encoding='utf-8') as out:
        reader = csv.reader(f)
        
        out.write("SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n")
        out.write("START TRANSACTION;\n")
        out.write("SET time_zone = \"+00:00\";\n\n")

        insert_header = (
            "INSERT INTO `customers` (`company_id`, `customer_code`, `first_name`, `last_name`, `phone`, `email`, "
            "`address`, `district`, `province`, `postal_code`, `temperature_status`, `customer_grade`, "
            "`total_purchase_amount`, `assigned_to`, `basket_type`, `assigned_at`, `last_contact_at`, "
            "`next_followup_at`, `recall_at`, `recall_reason`, `source`, `notes`, `is_active`, `created_at`, "
            "`updated_at`, `appointment_count`, `appointment_extension_count`, `last_appointment_date`, "
            "`appointment_extension_expiry`, `max_appointment_extensions`, `appointment_extension_days`, "
            "`customer_status`, `customer_time_extension`, `customer_time_base`, `customer_time_expiry`, "
            " `plant_variety`, `garden_size`, `is_blocked`) VALUES "
        )

        batch_size = 1000
        values_batch = []
        count = 0

        for row in reader:
            if not row: continue
            
            # Use trial logic to handle 44 columns correctly
            # Mapping based on previous analysis:
            # 0: old_id, 1: customer_code, 2: first_name, 3: last_name, 4: phone, 5: email, 7: province_name, 
            # 8: company_id, 9: assigned_to, 10: assigned_at?, 14: basket_type, 15: temp_status, 16: grade, 17: amount,
            # 21: address, 22: district_tambon, 23: district_amphoe, 24: postal_code, 27: appointment_count,
            # 33: is_active, 34: is_blocked, 40: customer_status
            
            try:
                company_id = row[8] if len(row) > 8 else '1'
                customer_code = row[1] if len(row) > 1 else ''
                first_name = row[2] if len(row) > 2 else ''
                last_name = row[3] if len(row) > 3 else ''
                phone = row[4] if len(row) > 4 else ''
                email = row[5] if len(row) > 5 else ''
                address = row[21] if len(row) > 21 else ''
                district = row[23] if len(row) > 23 else '' # Use index 23 for district (Amphoe)
                province = row[7] if len(row) > 7 else ''
                postal_code = row[24] if len(row) > 24 else ''
                temperature_status = (row[15].lower() if len(row) > 15 else 'cold')
                customer_grade = row[16] if len(row) > 16 else 'D'
                total_purchase_amount = row[17] if len(row) > 17 else '0'
                assigned_to = row[9] if len(row) > 9 and row[9] != 'NULL' else 'NULL'
                basket_type = row[14] if len(row) > 14 else 'waiting'
                
                # Dates
                updated_at = format_date(row[10]) if len(row) > 10 else 'NULL'
                created_at = format_date(row[12]) if len(row) > 12 else 'NULL'
                assigned_at = format_date(row[10]) if len(row) > 10 else 'NULL' # Using index 10 for assignment
                last_contact_at = format_date(row[30]) if len(row) > 30 else 'NULL'
                recall_at = format_date(row[13]) if len(row) > 13 else 'NULL'
                
                is_active = row[33] if len(row) > 33 else '1'
                appointment_count = row[27] if len(row) > 27 else '0'
                customer_status = row[40] if len(row) > 40 else 'new'
                is_blocked = row[34] if len(row) > 34 else '0'
                
                # Build values tuple
                vals = (
                    company_id, escape_sql(customer_code), escape_sql(first_name), escape_sql(last_name),
                    escape_sql(phone), escape_sql(email), escape_sql(address), escape_sql(district),
                    escape_sql(province), escape_sql(postal_code), escape_sql(temperature_status),
                    escape_sql(customer_grade), total_purchase_amount, assigned_to, escape_sql(basket_type),
                    assigned_at, last_contact_at, 'NULL', recall_at, 'NULL', "'PRIMA'", 'NULL',
                    is_active, created_at, updated_at, appointment_count, '0', 'NULL', 'NULL', '3', '30',
                    escape_sql(customer_status), '0', 'NULL', 'NULL', 'NULL', 'NULL', is_blocked
                )
                
                values_batch.append(f"({', '.join(vals)})")
                count += 1
                
                if len(values_batch) >= batch_size:
                    out.write(insert_header + ",\n".join(values_batch) + ";\n\n")
                    values_batch = []
                    print(f"Processed {count} rows...")

            except Exception as e:
                print(f"Error processing row {count}: {e}")
                continue

        if values_batch:
            out.write(insert_header + ",\n".join(values_batch) + ";\n\n")

        out.write("COMMIT;\n")
        print(f"Done. Total rows processed: {count}")

if __name__ == "__main__":
    convert()
