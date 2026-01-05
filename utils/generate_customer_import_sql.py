import csv
import sys
from datetime import datetime

# Input configuration
INPUT_FILE = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customer_company1 2 73 - Copy.csv'
OUTPUT_FILE = r'c:\AppServ\www\CRM_ERP_V4\import_customers_company1.sql'

def parse_date(date_str):
    if not date_str or date_str.lower() == 'null' or not date_str.strip():
        return 'NULL'
    try:
        # Format: 24/12/2025 9:19
        dt = datetime.strptime(date_str.strip(), '%d/%m/%Y %H:%M')
        return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"
    except ValueError:
        try:
             # Retry with seconds just in case
            dt = datetime.strptime(date_str.strip(), '%d/%m/%Y %H:%M:%S')
            return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"
        except:
            return 'NULL'

def safe_str(val):
    if not val or val.lower() == 'null' or not val.strip():
        return 'NULL'
    # Escape single quotes for SQL
    val = val.replace("'", "''").strip()
    return f"'{val}'"

def safe_int(val, default=0):
    if not val or val.lower() == 'null' or not val.strip():
        return str(default)
    try:
        return str(int(float(val)))
    except:
        return str(default)

def generate_sql():
    print(f"Reading from {INPUT_FILE}...")
    
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        # Check if first line is header? It looked like data in the preview (233411,...)
        # But commonly CSVs have headers. The user view showed line 1 starting with a numeric ID.
        # So assumes NO HEADER.
        reader = csv.reader(f)
        
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as out:
            out.write("-- Import script for customer_company1\n")
            out.write("-- Generated automatically\n\n")
            
            count = 0
            batch_size = 500
            current_batch = []
            
            # Columns Mapping based on visual inspection of Row 1
            # 0: id (skip)
            # 1: customer_ref_id
            # 2: first_name
            # 3: last_name
            # 4: phone
            # 5: backup_phone
            # 6: email
            # 7: province
            # 8: company_id
            # 9: assigned_to
            # 10: date_assigned
            # 11: date_registered (Inferred)
            # 12: follow_up_date (Inferred)
            # 13: ownership_expires
            # 14: lifecycle_status
            # 15: behavioral_status
            # 16: grade
            # 17: total_purchases
            # 18: total_calls
            # 19: facebook_name
            # 20: line_id
            # 21: street
            # 22: subdistrict
            # 23: district
            # 24: postal_code
            
            for row in reader:
                if not row or len(row) < 25:
                    continue
                
                # Check if it's actually a header (unlikely given numeric starts, but safety)
                if row[0] == 'id' or row[0] == 'customer_id':
                    continue

                ref_id = safe_str(row[1])
                first_name = safe_str(row[2])
                last_name = safe_str(row[3])
                phone = safe_str(row[4])
                
                # Deduplication logic could go here, but simple INSERT IGNORE or ON DUPLICATE KEY UPDATE is safer for SQL script
                
                backup_phone = safe_str(row[5])
                email = safe_str(row[6])
                province = safe_str(row[7])
                company_id = safe_int(row[8], 1)
                assigned_to = safe_int(row[9], 0)
                if assigned_to == '0' or assigned_to == 'NULL':
                    assigned_to = 'NULL'
                
                date_assigned = parse_date(row[10])
                date_registered = parse_date(row[11]) 
                follow_up_date = parse_date(row[12])
                ownership_expires = parse_date(row[13])
                
                lifecycle = safe_str(row[14])
                behavioral = safe_str(row[15])
                grade = safe_str(row[16])
                
                total_purchases = safe_int(row[17])
                total_calls = safe_int(row[18])
                
                fb = safe_str(row[19])
                line = safe_str(row[20])
                
                street = safe_str(row[21])
                subdistrict = safe_str(row[22])
                district = safe_str(row[23])
                postal = safe_str(row[24])
                
                sql = f"({ref_id}, {first_name}, {last_name}, {phone}, {backup_phone}, {email}, {street}, {subdistrict}, {district}, {province}, {postal}, {company_id}, {assigned_to}, {date_assigned}, {date_registered}, {follow_up_date}, {ownership_expires}, {lifecycle}, {behavioral}, {grade}, {total_purchases}, {total_calls}, {fb}, {line})"
                current_batch.append(sql)
                count += 1
                
                if len(current_batch) >= batch_size:
                    values = ",\n".join(current_batch)
                    stmt = f"INSERT INTO customers (customer_ref_id, first_name, last_name, phone, backup_phone, email, street, subdistrict, district, province, postal_code, company_id, assigned_to, date_assigned, date_registered, follow_up_date, ownership_expires, lifecycle_status, behavioral_status, grade, total_purchases, total_calls, facebook_name, line_id) VALUES \n{values};\n"
                    out.write(stmt)
                    current_batch = []
            
            # Flush remaining
            if current_batch:
                values = ",\n".join(current_batch)
                stmt = f"INSERT INTO customers (customer_ref_id, first_name, last_name, phone, backup_phone, email, street, subdistrict, district, province, postal_code, company_id, assigned_to, date_assigned, date_registered, follow_up_date, ownership_expires, lifecycle_status, behavioral_status, grade, total_purchases, total_calls, facebook_name, line_id) VALUES \n{values};\n"
                out.write(stmt)
                
            print(f"Done. Generated SQL for {count} rows.")

if __name__ == "__main__":
    generate_sql()
