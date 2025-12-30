import csv
import sys
from datetime import datetime
import re

def parse_date(date_str):
    if not date_str or date_str == 'NULL' or not date_str.strip():
        return 'NULL'
    
    # Try parsing "dd/mm/YYYY HH:MM" format (e.g., 30/12/2025 9:41)
    try:
        dt = datetime.strptime(date_str, '%d/%m/%Y %H:%M')
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except ValueError:
        pass
        
    # Try Excel serial date just in case
    try:
        base_date = datetime(1899, 12, 30)
        delta = datetime.timedelta(days=float(date_str))
        return (base_date + delta).strftime('%Y-%m-%d %H:%M:%S')
    except (ValueError, TypeError):
        pass

    return date_str

def fix_csv(input_path, output_path):
    print(f"Reading from {input_path}...")
    
    with open(input_path, 'r', encoding='utf-8') as f_in, \
         open(output_path, 'w', encoding='utf-8', newline='') as f_out:
        
        reader = csv.reader(f_in)
        writer = csv.writer(f_out, quoting=csv.QUOTE_MINIMAL)

        row_count = 0
        for row in reader:
            if not row: continue

            # Skip empty lines
            if all(not cell.strip() for cell in row):
                continue
                
            new_row = list(row)

            # Ensure we have enough columns to start with (17 expected)
            while len(new_row) < 17:
                new_row.append('NULL')

            # 1. Handle Name Split (Index 3 -> Index 3 & 4)
            full_name = new_row[3].strip()
            # Split by first space
            parts = full_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''
            
            new_row[3] = first_name
            new_row[4] = last_name # Overwrite empty column 4

            # 2. Insert role_id at index 8
            # Schema: ... role(7), role_id(8), company_id(9) ...
            # Current row after Name split logic (cols 0-16):
            # 0:id, 1:user, 2:pass, 3:fname, 4:lname, 5:email, 6:phone, 7:role
            # 8: company_id is here now.
            # We want to insert role_id at index 8.
            new_row.insert(8, 'NULL') 
            
            # Now indices shifted:
            # 8: role_id (new)
            # 9: company_id (old 8)
            # ...
            # 14: status (old 12) -> Wait.
            #   Old 8 -> New 9
            #   Old 9 -> New 10
            #   Old 10 -> New 11
            #   Old 11 -> New 12 (id_oth)
            #   Old 12 -> New 13 (status) - Schema says status is 14?
            
            # Let's count again.
            # Schema: 
            # 1. id
            # 2. username
            # 3. password
            # 4. first_name
            # 5. last_name
            # 6. email
            # 7. phone
            # 8. role
            # 9. role_id
            # 10. company_id
            # 11. team_id
            # 12. supervisor_id
            # 13. id_oth
            # 14. status
            # 15. created_at
            # 16. updated_at
            # 17. last_login
            # 18. login_count
            
            # My Code:
            # 0: id
            # 1: username
            # 2: pass
            # 3: fname
            # 4: lname
            # 5: email
            # 6: phone
            # 7: role
            # 8: role_id (Inserted)
            # 9: company_id
            # 10: team_id
            # 11: supervisor_id
            # 12: id_oth
            # 13: status
            # 14: created
            # 15: updated
            # 16: last_login
            # 17: count
            
            # Correct! (Indices 0-17 = 18 columns)
            
            # 3. Convert Dates
            # Created at is now index 14
            if len(new_row) > 14:
                new_row[14] = parse_date(new_row[14])
            # Updated at is now index 15
            if len(new_row) > 15:
                new_row[15] = parse_date(new_row[15])
                
            writer.writerow(new_row)
            row_count += 1
            
    print(f"Finished processing {row_count} rows.")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    input_file = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\user20251230.csv'
    output_file = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\fixed_user20251230_v2.csv'
    fix_csv(input_file, output_file)
