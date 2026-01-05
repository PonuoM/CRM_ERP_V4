import csv
import os
from datetime import datetime

input_csv = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customer_company1 2 7 copy.csv'
output_sql = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_import_new_schema.sql'

def format_date(date_str):
    if not date_str or date_str.lower() == 'null' or date_str.strip() == '':
        return 'NULL'
    try:
        # CSV format: 15/12/2025 11:02 or 15/12/2025
        date_str = date_str.strip()
        if '/' in date_str:
            if ' ' in date_str:
                dt = datetime.strptime(date_str, '%d/%m/%Y %H:%M')
            else:
                dt = datetime.strptime(date_str, '%d/%m/%Y')
        else:
            if ' ' in date_str:
                dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
            else:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
        
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

        # Column names from customers (8).sql
        columns = [
            "customer_id", "customer_ref_id", "first_name", "last_name", "phone", 
            "backup_phone", "email", "province", "company_id", "assigned_to", 
            "date_assigned", "date_registered", "follow_up_date", "ownership_expires", 
            "lifecycle_status", "behavioral_status", "grade", "total_purchases", 
            "total_calls", "facebook_name", "line_id", "street", 
            "subdistrict", "district", "postal_code", "recipient_first_name", 
            "recipient_last_name", "has_sold_before", "follow_up_count", "last_follow_up_date", 
            "last_sale_date", "is_in_waiting_basket", "waiting_basket_start_date", 
            "followup_bonus_remaining", "is_blocked", "first_order_date", "last_order_date", 
            "order_count", "is_new_customer", "is_repeat_customer", "bucket_type", 
            "ai_last_updated", "ai_reason_thai", "ai_score"
        ]
        
        insert_header = f"INSERT INTO `customers` (`{'`, `'.join(columns)}`) VALUES "

        batch_size = 1000
        values_batch = []
        count = 0

        for row in reader:
            if not row: continue
            
            try:
                processed_row = []
                for i in range(len(columns)):
                    val = row[i] if i < len(row) else 'NULL'
                    
                    # date_assigned: 10, date_registered: 11, follow_up_date: 12, ownership_expires: 13
                    # last_follow_up_date: 29, last_sale_date: 30, waiting_basket_start_date: 32
                    # first_order_date: 35, last_order_date: 36, ai_last_updated: 41
                    date_indices = {10, 11, 12, 13, 29, 30, 32, 35, 36, 41}
                    
                    # customer_id: 0, company_id: 8, assigned_to: 9, total_calls: 18
                    # has_sold_before: 27, follow_up_count: 28, is_in_waiting_basket: 31
                    # followup_bonus_remaining: 33, is_blocked: 34, order_count: 37
                    # is_new_customer: 38, is_repeat_customer: 39, ai_score: 43
                    int_indices = {0, 8, 9, 18, 27, 28, 31, 33, 34, 37, 38, 39, 43}
                    
                    # total_purchases: 17
                    decimal_indices = {17}

                    if i in date_indices:
                        processed_row.append(format_date(val))
                    elif i in int_indices or i in decimal_indices:
                        if val.lower() == 'null' or val.strip() == '':
                            processed_row.append('NULL')
                        else:
                            processed_row.append(val.strip())
                    else:
                        processed_row.append(escape_sql(val))

                values_batch.append(f"({', '.join(processed_row)})")
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
