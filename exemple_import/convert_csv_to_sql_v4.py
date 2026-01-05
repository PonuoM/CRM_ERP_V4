import csv
import os
from datetime import datetime

input_csv = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customer_company1 2 7 copy 2.csv'
output_sql = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_import_v4.sql'

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
                if '.' in date_str: # Handle possible fractional seconds
                    dt = datetime.strptime(date_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                else:
                    dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
            else:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
        
        return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"
    except:
        return 'NULL'

def escape_sql(val):
    if val is None or str(val).lower() == 'null' or str(val).strip() == '':
        return 'NULL'
    # Escape backslashes first to prevent them from escaping our SQL quotes
    # replace \ with \\
    safe_val = str(val).replace('\\', '\\\\')
    # Escape single quotes by doubling them (SQL standard)
    safe_val = safe_val.replace("'", "''")
    return f"'{safe_val}'"

def convert():
    if not os.path.exists(input_csv):
        print(f"Error: {input_csv} not found")
        return

    # Use a set for faster lookup
    date_indices = {10, 11, 12, 13, 29, 30, 32, 35, 36, 41}
    int_indices = {0, 8, 9, 18, 27, 28, 31, 33, 34, 37, 38, 39, 43}
    decimal_indices = {17}

    with open(input_csv, 'r', encoding='utf-8-sig') as f, open(output_sql, 'w', encoding='utf-8') as out:
        # Using excel dialect but being careful with quotes
        reader = csv.reader(f, quotechar='"', doublequote=True, skipinitialspace=True)
        
        # Cleanup and FK checks
        out.write("SET FOREIGN_KEY_CHECKS = 0;\n")
        out.write("SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n")
        out.write("DELETE FROM `customers` WHERE `company_id` IN (1, 2, 7);\n")
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
        malformed_count = 0

        for line_num, row in enumerate(reader, 1):
            if not row: continue
            
            # Check column count
            if len(row) != len(columns):
                # If we have more than expected, it might be a parsing issue
                # But let's try to handle it or at least log it
                if malformed_count < 10:
                    print(f"Warning: Row {line_num} has {len(row)} columns, expected {len(columns)}.")
                malformed_count += 1
            
            try:
                processed_row = []
                for i in range(len(columns)):
                    if i < len(row):
                        val = row[i]
                    else:
                        val = 'NULL'
                    
                    if i in date_indices:
                        processed_row.append(format_date(val))
                    elif i in int_indices or i in decimal_indices:
                        if val is None or val.lower() == 'null' or val.strip() == '':
                            processed_row.append('NULL')
                        else:
                            # Clean up numeric values (remove commas, spaces)
                            clean_val = val.strip().replace(',', '')
                            if not clean_val:
                                processed_row.append('NULL')
                            else:
                                processed_row.append(clean_val)
                    else:
                        processed_row.append(escape_sql(val))

                values_batch.append(f"({', '.join(processed_row)})")
                count += 1
                
                if len(values_batch) >= batch_size:
                    out.write(insert_header + ",\n".join(values_batch) + ";\n\n")
                    values_batch = []
                    if count % 10000 == 0:
                        print(f"Processed {count} rows...")

            except Exception as e:
                print(f"Error processing row {line_num}: {e}")
                continue

        if values_batch:
            out.write(insert_header + ",\n".join(values_batch) + ";\n\n")

        out.write("COMMIT;\n")
        out.write("SET FOREIGN_KEY_CHECKS = 1;\n")
        print(f"Done. Total rows processed: {count}")
        if malformed_count > 0:
            print(f"Total rows with mismatched column counts: {malformed_count}")

if __name__ == "__main__":
    convert()
