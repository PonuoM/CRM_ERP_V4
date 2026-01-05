import csv
import re
import os

def load_master_data(sql_file):
    provinces = {}  # id -> name_th
    districts = {}   # id -> (name_th, province_id)
    subdistricts = [] # list of (name_th, district_id, zip_code)

    re_province = re.compile(r"\((\d+),\s*'([^']+)',\s*'[^']*',\s*\d+,")
    re_district = re.compile(r"\((\d+),\s*'([^']+)',\s*'[^']*',\s*(\d+),")
    re_subdistrict = re.compile(r"\((\d+),\s*'(\d+)',\s*'([^']+)',\s*'[^']*',\s*(\d+),")

    current_table = None
    with open(sql_file, 'r', encoding='utf-8') as f:
        for line in f:
            if 'INSERT INTO `address_provinces`' in line:
                current_table = 'provinces'
            elif 'INSERT INTO `address_districts`' in line:
                current_table = 'districts'
            elif 'INSERT INTO `address_sub_districts`' in line:
                current_table = 'subdistricts'
            
            if current_table == 'provinces':
                matches = re_province.findall(line)
                for m in matches:
                    provinces[int(m[0])] = m[1]
            elif current_table == 'districts':
                matches = re_district.findall(line)
                for m in matches:
                    districts[int(m[0])] = (m[1], int(m[2]))
            elif current_table == 'subdistricts':
                matches = re_subdistrict.findall(line)
                for m in matches:
                    subdistricts.append({
                        'name': m[2],
                        'district_id': int(m[3]),
                        'zip_code': m[1]
                    })
    
    # Denormalize for easy lookup
    master_list = []
    for sub in subdistricts:
        d_name, p_id = districts.get(sub['district_id'], (None, None))
        p_name = provinces.get(p_id) if p_id else None
        if d_name and p_name:
            master_list.append({
                'subdistrict': sub['name'],
                'district': d_name,
                'province': p_name,
                'zip_code': sub['zip_code']
            })
    return master_list

def clean_name(name):
    if not name: return ""
    res = name.strip()
    # Remove common prefixes and symbols from start
    while True:
        changed = False
        prefixes = ['ต.', 'อ.', 'จ.', 'แขวง', 'เขต', 'จังหวัด', 'ตำบล', 'อำเภอ', '.', ' ', '*']
        for p in prefixes:
            if res.startswith(p):
                res = res[len(p):].strip()
                changed = True
        if not changed:
            break
    return res

def find_best_match(row, master_data):
    # If subdistrict or district is empty, try to extract from street
    street = row['street'] or ""
    s_input = clean_name(row['subdistrict'])
    d_input = clean_name(row['district'])
    p_input = clean_name(row['province'])
    z_input = str(row['postal_code']).split('.')[0].strip()

    if not s_input or not d_input:
        # Try to find subdistrict/district keywords in street
        # e.g. "ตำบล.บ้านด่านนาขาม" -> "บ้านด่านนาขาม"
        for keyword in ['ตำบล', 'ต.', 'แขวง']:
            if keyword in street:
                parts = street.split(keyword)
                if len(parts) > 1:
                    candidate = parts[1].split(' ')[0].split(',')[0].strip(' .')
                    if not s_input: s_input = candidate
        for keyword in ['อำเภอ', 'อ.', 'เขต']:
            if keyword in street:
                parts = street.split(keyword)
                if len(parts) > 1:
                    candidate = parts[1].split(' ')[0].split(',')[0].strip(' .')
                    if not d_input: d_input = candidate

    # Strategy 1: Match by zip code primarily if provided
    zip_matches = [m for m in master_data if m['zip_code'] == z_input]
    
    if zip_matches:
        # 1.1 Try exact name match within zip matches
        for m in zip_matches:
            if s_input == m['subdistrict']:
                return m
        
        # 1.2 Try subdistrict name from street (specifically)
        for m in zip_matches:
            if m['subdistrict'] in street:
                return m

        # 1.3 Try partial name match within zip matches (longest match first)
        best_p_match = None
        for m in zip_matches:
            if s_input and (s_input in m['subdistrict'] or m['subdistrict'] in s_input):
                if not best_p_match or len(m['subdistrict']) > len(best_p_match['subdistrict']):
                    best_p_match = m
        if best_p_match: return best_p_match

        # 1.4 Try to match district if subdistrict failed
        for m in zip_matches:
            if d_input and (d_input in m['district'] or m['district'] in d_input):
                return m
        
        # 1.5 If multiple zip matches, try to match district name from street
        for m in zip_matches:
            if m['district'] in street:
                return m
                
        # Fallback to first zip match - only if zip is unique enough
        if len(zip_matches) == 1:
            return zip_matches[0]
        # If multiple zip matches, try to match province
        for m in zip_matches:
            if p_input and (p_input in m['province'] or m['province'] in p_input):
                return m
        return zip_matches[0]

    # Strategy 2: Match by exact names (Subdistrict + District + Province)
    for m in master_data:
        if s_input == m['subdistrict'] and d_input == m['district']:
            return m

    # Strategy 3: Match by subdistrict name if it's unique enough (only in street or s_input)
    if s_input:
        s_matches = [m for m in master_data if s_input == m['subdistrict']]
        if len(s_matches) == 1:
            return s_matches[0]

    return None

def main():
    sql_file = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\primacom_mini_erp.sql'
    csv_input = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_ready_updated.csv'
    csv_output = r'c:\AppServ\www\CRM_ERP_V4\exemple_import\customers_ready_validated.csv'

    print("Loading master data...")
    master_data = load_master_data(sql_file)
    print(f"Loaded {len(master_data)} subdistrict entries.")

    updated_rows = []
    with open(csv_input, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            match = find_best_match(row, master_data)
            if match:
                row['subdistrict'] = match['subdistrict']
                row['district'] = match['district']
                row['province'] = match['province']
                row['postal_code'] = match['zip_code']
            updated_rows.append(row)

    print(f"Writing validated data to {csv_output}...")
    with open(csv_output, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)
    print("Done.")

if __name__ == "__main__":
    main()
