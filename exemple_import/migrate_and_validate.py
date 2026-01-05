import csv
import re
import sys
import pandas as pd

# Define input and output file paths
INPUT_FILE = 'customers (old).csv'
OUTPUT_FILE = 'customers_final_validated.csv'
MASTER_DATA_FILE = 'primacom_mini_erp.sql'

# Target columns (44 columns)
TARGET_COLUMNS = [
    'customer_id', 'customer_ref_id', 'first_name', 'last_name', 'phone', 'backup_phone',
    'email', 'province', 'company_id', 'assigned_to', 'date_assigned', 'date_registered',
    'follow_up_date', 'ownership_expires', 'lifecycle_status', 'behavioral_status', 'grade',
    'total_purchases', 'total_calls', 'facebook_name', 'line_id', 'street', 'subdistrict',
    'district', 'postal_code', 'recipient_first_name', 'recipient_last_name', 'has_sold_before',
    'follow_up_count', 'last_follow_up_date', 'last_sale_date', 'is_in_waiting_basket',
    'waiting_basket_start_date', 'followup_bonus_remaining', 'is_blocked', 'first_order_date',
    'last_order_date', 'order_count', 'is_new_customer', 'is_repeat_customer', 'bucket_type',
    'ai_last_updated', 'ai_reason_thai', 'ai_score'
]

# Common Thai prefixes to remove
PREFIXES = [
    "คุณ", "นาย", "นางสาว", "นาง", "ด.ญ.", "ด.ช.", "น.ส.", "น.ส ",
    "อาจารย์", "ดร.", "ผศ.", "รศ.", "ศ.", "พล.ต.อ.", "พล.ต.ท.", "พล.ต.ต.",
    "พ.ต.อ.", "พ.ต.ท.", "พ.ต.ต.", "ร.ต.อ.", "ร.ต.ท.", "ร.ต.ต.",
    "จ.ส.อ.", "จ.ส.ท.", "จ.ส.ต.", "ส.อ.", "ส.ท.", "ส.ต.",
    "พลฯ", "พี่", "น้อง", "เจ๊", "เฮีย", "ลุง", "ป้า", "น้า", "อา",
    "ร้าน", "บจก.", "บมจ.", "หจก.", "หสน."
]

def load_master_data(sql_file):
    """Loads master address data from SQL DUMP file."""
    master_list = []
    
    provinces = {} # id -> name
    districts = {} # id -> {name, province_id}
    subdistricts = [] # list of {zip, name, district_id}

    print(f"Reading SQL file: {sql_file}")
    
    try:
        with open(sql_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Parse based on 'INSERT INTO `table`' blocks
        blocks = content.split('INSERT INTO')
        
        for block in blocks:
            match = re.search(r'^\s*`(\w+)`', block)
            if not match:
                continue
                
            table_name = match.group(1)
            
            if "VALUES" not in block:
                continue
                
            values_section = block.split("VALUES", 1)[1].strip()
            
            # Clean end of statement
            end_idx = values_section.rfind(';')
            if end_idx != -1:
                values_section = values_section[:end_idx]
            
            # Robust split using regex to handle "),\n(" or "), ("
            rows = re.split(r'\),\s*\(', values_section)
            
            for i, row in enumerate(rows):
                # Clean start/end parens
                if i == 0: row = row.lstrip('(')
                if i == len(rows) - 1: row = row.rstrip(')')
                
                # Split by comma respecting quotes
                parts = []
                current_part = []
                in_quote = False
                for char in row:
                    if char == "'":
                        in_quote = not in_quote
                    elif char == "," and not in_quote:
                        parts.append("".join(current_part).strip().strip("'"))
                        current_part = []
                    else:
                        current_part.append(char)
                parts.append("".join(current_part).strip().strip("'"))
                
                # Check table and valid length
                # Note: Schema indices are based on analysis of primacom_mini_erp.sql
                if table_name == 'address_provinces':
                    if len(parts) >= 2:
                        p_id = parts[0]
                        p_name = parts[1]
                        provinces[p_id] = p_name
                        
                elif table_name == 'address_districts':
                    if len(parts) >= 4:
                        d_id = parts[0]
                        d_name = parts[1]
                        p_id = parts[3]
                        districts[d_id] = {'name': d_name, 'province_id': p_id}
                        
                elif table_name == 'address_sub_districts':
                    if len(parts) >= 5:
                        zip_code = parts[1]
                        s_name = parts[2]
                        d_id = parts[4]
                        subdistricts.append({
                            'zip': zip_code,
                            'name': s_name,
                            'district_id': d_id
                        })

    except Exception as e:
        print(f"Error parsing SQL: {e}")
        return []

    # Denormalize
    print(f"Parsed {len(provinces)} provinces, {len(districts)} districts, {len(subdistricts)} subdistricts.")

    for sub in subdistricts:
        d_id = sub['district_id']
        if d_id in districts:
            dist = districts[d_id]
            p_id = dist['province_id']
            if p_id in provinces:
                master_list.append({
                    'subdistrict': sub['name'],
                    'district': dist['name'],
                    'province': provinces[p_id],
                    'postal_code': sub['zip']
                })
    
    return master_list

def clean_name(name):
    if not isinstance(name, str):
        return "", ""
    
    clean = name.strip()
    clean = re.sub(r'\(.*?\)', '', clean)
    clean = re.sub(r'\*\*.*', '', clean)
    
    sorted_prefixes = sorted(PREFIXES, key=len, reverse=True)
    for prefix in sorted_prefixes:
        if clean.startswith(prefix):
            clean = clean[len(prefix):].strip()
            break
            
    parts = clean.split()
    if len(parts) >= 2:
        return parts[0], " ".join(parts[1:])
    elif len(parts) == 1:
        return parts[0], "."
    else:
        return "", ""

def find_best_match(postal_code, subdistrict_in, district_in, province_in, master_data):
    postal_code = str(postal_code).split('.')[0] if pd.notna(postal_code) else ""
    subdistrict_in = str(subdistrict_in).strip() if pd.notna(subdistrict_in) else ""
    district_in = str(district_in).strip() if pd.notna(district_in) else ""
    province_in = str(province_in).strip() if pd.notna(province_in) else ""
    
    matches = [m for m in master_data if str(m['postal_code']) == postal_code]
    
    if not matches:
        name_matches = [m for m in master_data if m['province'] == province_in and m['district'] == district_in]
        if name_matches:
             return name_matches[0]['subdistrict'], name_matches[0]['district'], name_matches[0]['province'], name_matches[0]['postal_code']
        return subdistrict_in, district_in, province_in, postal_code

    def clean_geo(txt):
        return txt.replace('ต.', '').replace('อ.', '').replace('จ.', '').replace('แขวง', '').replace('เขต', '').replace('ตำบล', '').replace('อำเภอ', '').replace('จังหวัด', '').strip()

    clean_sub = clean_geo(subdistrict_in)
    clean_dist = clean_geo(district_in)
    
    for m in matches:
        if clean_sub == m['subdistrict']:
            return m['subdistrict'], m['district'], m['province'], m['postal_code']
            
    for m in matches:
        if clean_dist == m['district']:
            return subdistrict_in, m['district'], m['province'], m['postal_code']

    return subdistrict_in, district_in, matches[0]['province'], postal_code

def extract_address_from_street(street_text):
    if not isinstance(street_text, str):
        return "", "", "", ""
        
    sub = ""
    dist = ""
    prov = ""
    zip_c = ""
    
    m_prov = re.search(r'(?:จ\.|จังหวัด)\s*([ก-๙]+)', street_text)
    if m_prov: prov = m_prov.group(1)
    
    m_dist = re.search(r'(?:อ\.|อำเภอ|เขต)\s*([ก-๙]+)', street_text)
    if m_dist: dist = m_dist.group(1)
    
    m_sub = re.search(r'(?:ต\.|ตำบล|แขวง)\s*([ก-๙]+)', street_text)
    if m_sub: sub = m_sub.group(1)
    
    m_zip = re.search(r'\b(\d{5})\b', street_text)
    if m_zip: zip_c = m_zip.group(1)
    
    return sub, dist, prov, zip_c

from datetime import datetime, timedelta

def convert_date(val):
    if not val or pd.isna(val) or str(val).lower() == 'null' or str(val) == '':
        return ''
    
    val_str = str(val).strip()
    
    # If already YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}', val_str):
        return val_str
    
    # Handle Excel float
    try:
        if '.' in val_str or val_str.isdigit():
            float_val = float(val_str)
            if float_val > 1000: # Heuristic for Excel date
                dt = datetime(1899, 12, 30) + timedelta(days=float_val)
                return dt.strftime('%Y-%m-%d %H:%M:%S')
    except ValueError:
        pass
        
    # Handle DD/MM/YYYY HH:MM
    try:
        if '/' in val_str:
            # Try various formats
            for fmt in ('%d/%m/%Y %H:%M', '%m/%d/%Y %H:%M', '%Y/%m/%d %H:%M'):
                try:
                    dt = datetime.strptime(val_str, fmt)
                    return dt.strftime('%Y-%m-%d %H:%M:%S')
                except ValueError:
                    continue
    except Exception:
        pass

    return val_str

def map_lifecycle_status(status):
    if not isinstance(status, str):
        return 'New' # Default empty to New
    
    s = status.strip().lower()
    if s == 'new':
        return 'New'
    elif s == 'daily_distribution':
        return 'DailyDistribution'
    elif s == 'existing_3m':
        return 'Old3Months'
    elif s == 'existing':
        return 'Old'
    elif s == 'followup':
        return 'Followup'
    
    return s.capitalize()

def main():
    print("Loading master data...")
    master_data = load_master_data(MASTER_DATA_FILE)
    print(f"Loaded {len(master_data)} master address records.")
    
    print("Reading old CSV...")
    df = pd.read_csv(INPUT_FILE, encoding='utf-8-sig', dtype=str)
    
    results = []
    
    for idx, row in df.iterrows():
        new_row = {col: '' for col in TARGET_COLUMNS}
        
        new_row['customer_id'] = row.get('customer_id', '')
        new_row['customer_ref_id'] = row.get('customer_code', '')
        new_row['company_id'] = row.get('company_id', '')
        
        full_name = row.get('first_name', '')
        fname, lname = clean_name(full_name)
        new_row['first_name'] = fname
        new_row['last_name'] = lname
        
        new_row['phone'] = row.get('phone', '')
        new_row['email'] = row.get('email', '')
        
        orig_addr = row.get('address', '')
        p_sub, p_dist, p_prov, p_zip = extract_address_from_street(orig_addr)
        
        input_sub = p_sub
        input_dist = row.get('district', '') if pd.notna(row.get('district')) else p_dist
        input_prov = row.get('province', '') if pd.notna(row.get('province')) else p_prov
        input_zip = row.get('postal_code', '') if pd.notna(row.get('postal_code')) else p_zip
        
        v_sub, v_dist, v_prov, v_zip = find_best_match(input_zip, input_sub, input_dist, input_prov, master_data)
        
        new_row['street'] = orig_addr 
        new_row['subdistrict'] = v_sub
        new_row['district'] = v_dist
        new_row['province'] = v_prov
        new_row['postal_code'] = v_zip
        
        new_row['date_assigned'] = convert_date(row.get('assigned_at', ''))
        new_row['date_registered'] = convert_date(row.get('created_at', ''))
        new_row['follow_up_date'] = convert_date(row.get('next_followup_at', ''))
        new_row['ownership_expires'] = convert_date(row.get('customer_time_expiry', ''))
        new_row['last_follow_up_date'] = convert_date(row.get('last_contact_at', ''))
        
        raw_status = row.get('customer_status', '')
        new_row['lifecycle_status'] = map_lifecycle_status(raw_status)
        
        new_row['behavioral_status'] = row.get('temperature_status', '').capitalize() if pd.notna(row.get('temperature_status')) else ''
        new_row['grade'] = row.get('customer_grade', '')
        
        total_p = row.get('total_purchase_amount', '0')
        try:
            total_p_float = float(total_p)
        except:
            total_p_float = 0.0
            
        new_row['total_purchases'] = str(total_p_float)
        new_row['assigned_to'] = row.get('assigned_to', '')
        new_row['is_blocked'] = row.get('is_blocked', '0')
        new_row['followup_bonus_remaining'] = '1'
        new_row['total_calls'] = '0'
        new_row['order_count'] = '0'
        new_row['bucket_type'] = row.get('basket_type', '')
        
        # Determine New/Repeat/Sold
        if total_p_float > 0:
            new_row['has_sold_before'] = '1'
            new_row['is_repeat_customer'] = '1'
            new_row['is_new_customer'] = '0'
        else:
            new_row['has_sold_before'] = '0'
            new_row['is_repeat_customer'] = '0'
            new_row['is_new_customer'] = '1'
            
        results.append(new_row)
        
    print(f"Writing {len(results)} rows to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=TARGET_COLUMNS)
        # writer.writeheader() # Header removed as per user request
        writer.writerows(results)
        
    print("Done.")

if __name__ == "__main__":
    main()
