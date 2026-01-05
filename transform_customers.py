import csv
import re
from datetime import datetime, timedelta

def excel_to_datetime(excel_date):
    if not excel_date or str(excel_date).upper() == 'NULL' or str(excel_date).strip() == '':
        return None
    try:
        # Check if it's already a datetime string
        if '-' in str(excel_date):
            return str(excel_date)
        
        # Assume numeric Excel date
        float_date = float(excel_date)
        dt = datetime(1899, 12, 30) + timedelta(days=float_date)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except (ValueError, TypeError):
        return str(excel_date)

def parse_address(address):
    if not address or str(address).upper() == 'NULL':
        return "", "", ""
    
    # Clean address string
    addr = str(address).strip()
    
    subdistrict = ""
    district = ""
    
    # Patterns for subdistrict
    sd_matches = re.search(r'(ตำบล|ต\.|แขวง)\s*([^\s,.\d]+)', addr)
    if sd_matches:
        subdistrict = sd_matches.group(2)
        # Remove from street address
        addr = addr.replace(sd_matches.group(0), "").strip()
        
    # Patterns for district
    d_matches = re.search(r'(อำเภอ|อ\.|อําเภอ|เขต)\s*([^\s,.\d]+)', addr)
    if d_matches:
        district = d_matches.group(2)
        # Remove from street address
        addr = addr.replace(d_matches.group(0), "").strip()

    # Pattern for province - often at the end like จ.กาฬสินธุ์
    p_matches = re.search(r'(จังหวัด|จ\.)\s*([^\s,.\d]+)', addr)
    if p_matches:
        addr = addr.replace(p_matches.group(0), "").strip()

    # Clean up trailing dots, commas, spaces
    street = re.sub(r'[,.\s]+$', '', addr).strip()
    
    return street, subdistrict, district

def normalize_status(status, mapping):
    if not status or str(status).upper() == 'NULL':
        return None
    s = str(status).lower().strip()
    return mapping.get(s, s.capitalize())

# Mapping setup
lifecycle_map = {
    'followup': 'FollowUp',
    'existing_3m': 'Old3Months',
    'existing': 'Old',
    'new': 'New',
    'daily_distribution': 'DailyDistribution'
}

behavioral_map = {
    'hot': 'Hot',
    'warm': 'Warm',
    'cold': 'Cold',
    'frozen': 'Frozen'
}

input_file = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers (old) 2.csv'
output_file = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_ready_2.csv'

with open(input_file, mode='r', encoding='utf-8-sig') as infile:
    reader = csv.DictReader(infile)
    
    fieldnames = [
        'customer_id', 'first_name', 'last_name', 'phone', 'email', 
        'province', 'company_id', 'assigned_to', 'date_assigned', 'follow_up_date',
        'last_follow_up_date', 'lifecycle_status', 'behavioral_status', 
        'grade', 'total_purchases', 'total_calls', 'is_blocked',
        'street', 'subdistrict', 'district', 'postal_code', 
        'followup_bonus_remaining'
    ]
    
    with open(output_file, mode='w', encoding='utf-8', newline='') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in reader:
            street, subdistrict, district = parse_address(row['address'])
            
            # If district column in old CSV is populated, use it instead (but usually empty)
            if row.get('district') and str(row['district']).strip() != '':
                district = row['district']

            # Prepare new row
            new_row = {
                'customer_id': row['customer_id'],
                'first_name': row['first_name'],
                'last_name': row['last_name'],
                'phone': row['phone'],
                'email': row['email'],
                'street': street,
                'subdistrict': subdistrict,
                'district': district,
                'province': row['province'],
                'postal_code': row['postal_code'],
                'company_id': row['company_id'],
                'assigned_to': row['assigned_to'] if row['assigned_to'] != 'NULL' else None,
                'date_assigned': excel_to_datetime(row['assigned_at']),
                'follow_up_date': excel_to_datetime(row['next_followup_at']),
                'last_follow_up_date': excel_to_datetime(row['last_contact_at']),
                'lifecycle_status': normalize_status(row['customer_status'], lifecycle_map),
                'behavioral_status': normalize_status(row['temperature_status'], behavioral_map),
                'grade': row['customer_grade'].upper(),
                'total_purchases': row['total_purchase_amount'],
                'total_calls': 0, # Default
                'is_blocked': row['is_blocked'],
                'followup_bonus_remaining': 1 # Default
            }
            writer.writerow(new_row)

print("Finished transforming customers data.")
