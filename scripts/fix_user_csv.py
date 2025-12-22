import csv
import sys
from datetime import datetime, timedelta

def excel_date_to_datetime(serial):
    if not serial or serial == 'NULL':
        return 'NULL'
    try:
        # Excel base date is usually Dec 30, 1899
        base_date = datetime(1899, 12, 30)
        delta = timedelta(days=float(serial))
        return (base_date + delta).strftime('%Y-%m-%d %H:%M:%S')
    except ValueError:
        return serial

def fix_csv(input_path, output_path):
    print(f"Reading from {input_path}...")
    
    with open(input_path, 'r', encoding='utf-8') as f_in, \
         open(output_path, 'w', encoding='utf-8', newline='') as f_out:
        
        reader = csv.reader(f_in)
        writer = csv.writer(f_out, quoting=csv.QUOTE_MINIMAL)

        row_count = 0
        for row in reader:
            if not row: continue

            # Expected modifications:
            # 1. Split name at index 3 into first_name (idx 3) and last_name (idx 4)
            # 2. Remove index 11 (extra column)
            # 3. Convert dates at what will be index 13 and 14 (originally 13 and 14, but shifting indices might be tricky so let's be careful)
            
            # Current indices based on inspection:
            # 0: id
            # 1: username
            # 2: password
            # 3: Combined Name
            # 4: Empty (placeholder for last name?)
            # 5: email
            # 6: phone
            # 7: role
            # 8: company_id
            # 9: team_id
            # 10: supervisor_id
            # 11: EXTRA (NULL) -> REMOVE
            # 12: status
            # 13: created_at (Excel)
            # 14: updated_at (Excel)
            # 15: last_login
            # 16: login_count

            new_row = list(row)

            # 1. Handle Name Split
            full_name = new_row[3].strip()
            parts = full_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''
            
            # Clean up [Supervisor] tags/Brackets if needed, but user might want them. 
            # Looking at existing data: "ปอนด์ [Supervisor]", "[Supervisor]" acts as last name in SQL example.
            # SQL Example: 'ปอนด์', '[Supervisor]'
            # So simple split is correct.
            
            new_row[3] = first_name
            new_row[4] = last_name # Fill the empty column

            # 2. Remove Extra Column at index 11
            # We pop index 11.
            if len(new_row) > 11:
                new_row.pop(11)
            
            # Now indices are shifted:
            # 0-10: Same
            # 11: status (was 12)
            # 12: created_at (was 13)
            # 13: updated_at (was 14)
            # 14: last_login (was 15)
            # 15: login_count (was 16)
            
            # 3. Convert Dates
            if len(new_row) > 12:
                new_row[12] = excel_date_to_datetime(new_row[12])
            if len(new_row) > 13:
                new_row[13] = excel_date_to_datetime(new_row[13])
                
            writer.writerow(new_row)
            row_count += 1
            
    print(f"Finished processing {row_count} rows.")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    input_file = r'c:\AppServ\www\CRM_ERP_V4\userprima49.csv'
    output_file = r'c:\AppServ\www\CRM_ERP_V4\fixed_userprima49.csv'
    fix_csv(input_file, output_file)
