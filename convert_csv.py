import csv
import re
from datetime import datetime

# Read ordernew.csv
input_file = 'ordernew.csv'
output_file = 'sales_import_ready_v2.csv'

# Sales template headers
output_headers = [
    "วันที่ขาย",
    "วันที่จัดส่ง",
    "ชื่อลูกค้า",
    "นามสกุลลูกค้า",
    "เบอร์โทรลูกค้า",
    "อีเมลลูกค้า",
    "แขวง/ตำบลจัดส่ง",
    "เขต/อำเภอจัดส่ง",
    "จังหวัดจัดส่ง",
    "รหัสไปรษณีย์จัดส่ง",
    "ที่อยู่จัดส่ง",
    "รหัสสินค้า",
    "ชื่อสินค้า",
    "จำนวน",
    "ราคาต่อหน่วย",
    "ส่วนลด",
    "ยอดรวมรายการ",
    "รหัสพนักงานขาย",
    "รหัสผู้ดูแล",
    "วิธีชำระเงิน",
    "หมายเหตุคำสั่งซื้อ"
]

def parse_date(date_str):
    """Convert various date formats to YYYY-MM-DD"""
    if not date_str:
        return ""
    
    # Clean up
    date_str = date_str.strip()
    
    # Try DD/MM/YYYY format
    try:
        dt = datetime.strptime(date_str, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except:
        pass
    
    # Try already YYYY-MM-DD
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return date_str
    except:
        pass
    
    return date_str  # Return as-is if can't parse

def normalize_phone(phone):
    """Normalize phone number to 10 digits"""
    if not phone:
        return ""
    # Remove non-digits
    digits = re.sub(r'\D', '', str(phone))
    # Add leading 0 if needed
    if len(digits) == 9:
        digits = '0' + digits
    return digits

def parse_price(price_str):
    """Parse price string removing commas"""
    if not price_str:
        return "0"
    # Remove commas and quotes
    cleaned = str(price_str).replace(',', '').replace('"', '').strip()
    try:
        return str(float(cleaned))
    except:
        return "0"

def split_name(full_name):
    """Split full name into first and last name"""
    if not full_name:
        return "", ""
    parts = full_name.strip().split(' ', 1)
    first_name = parts[0] if len(parts) > 0 else ""
    last_name = parts[1] if len(parts) > 1 else ""
    return first_name, last_name

def normalize_payment(payment):
    """Normalize payment method"""
    if not payment:
        return "COD"
    payment_lower = str(payment).lower().strip()
    if 'โอน' in payment_lower or 'transfer' in payment_lower:
        return "โอน"
    return "COD"


def clean_address_component(value, component_type=None):
    """Clean extracted address component"""
    if not value:
        return ""
    # Remove leading/trailing prefixes
    value = re.sub(r'^(ต\.|ตำบล|แขวง|อ\.|อำเภอ|เขต|จ\.|จังหวัด)', '', value, flags=re.IGNORECASE).strip()
    
    # Remove trailing dots
    value = value.strip('.')
    
    # Stop at next component markers if they were captured (run-on text)
    if component_type == 'subdistrict':
        # Stop at Amphoe/District or Province or Zipcode
        # Relaxed regex to catch concatenated words
        match = re.search(r'(อ\.|อำเภอ|เขต|จ\.|จังหวัด|\d{5})', value)
        if match:
             # Only chop if the match is NOT at the start (meaning we found a subdistrict name first)
             # But clean_address_component already removed the prefix of the current component.
             # So if "เขี้ยวเหลืองอำเภอ...", match for "อำเภอ" is at index > 0.
             if match.start() > 0:
                value = value[:match.start()].strip()
            
    if component_type == 'district':
        # Stop at Province or Zipcode
        match = re.search(r'(จ\.|จังหวัด|\d{5})', value)
        if match:
             if match.start() > 0:
                value = value[:match.start()].strip()
            
    # Clean leftovers like leading dots again
    value = value.strip('. ')
    return value

def parse_thai_address(full_address):
    """Attempt to extract generic Thai address components using Regex"""
    if not full_address:
        return {}, {}, {}, {}
    
    components = {
        'subdistrict': '',
        'district': '',
        'province': '',
        'zipcode': ''
    }
    
    # Normalize spaces
    text = " " + full_address.replace("  ", " ").strip() + " "
    
    # 1. Zipcode (5 digits at the end or near end)
    zip_match = re.search(r'\b(\d{5})\b', text)
    if zip_match:
        components['zipcode'] = zip_match.group(1)
        
    # 2. Province (จ. or จังหวัด)
    # Match "จ." or "จังหวัด" followed by non-space characters
    prov_match = re.search(r'(?:จ\.|จังหวัด)\s*([^\s0-9]+)', text)
    if prov_match:
        components['province'] = prov_match.group(1).strip()
    elif components['zipcode']:
         # Fallback: Sometimes province comes before zipcode without prefix, but risky to guess
         pass

    # 3. District (อ. or อำเภอ or เขต)
    # Note: "เขต" is used in Bangkok instead of Amphoe
    dist_match = re.search(r'(?:อ\.|อำเภอ|เขต)\s*([^\s0-9]+)', text)
    if dist_match:
        components['district'] = dist_match.group(1).strip()
        
    # 4. Subdistrict (ต. or ตำบล or แขวง)
    # Note: "แขวง" is used in Bangkok instead of Tambon
    sub_match = re.search(r'(?:ต\.|ตำบล|แขวง)\s*([^\s0-9]+)', text)
    if sub_match:
        components['subdistrict'] = sub_match.group(1).strip()
        
    return components

# Read and transform
rows_out = []
with open(input_file, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        # Map columns from ordernew.csv
        sale_date = row.get('วันที่ขาย', '')
        sale_date_parsed = parse_date(sale_date)
        
        recipient_name = row.get('ชื่อผู้รับ', '').strip()
        first_name, last_name = split_name(recipient_name)
        
        phone = normalize_phone(row.get('เบอร์โทร', ''))
        
        # Skip rows without phone
        if not phone or len(phone) < 9:
            continue
        
        # Address handling
        full_address = row.get('ที่อยู่', '').strip()
        subdistrict = row.get('ตำบล', '').strip()
        district = row.get('อำเภอ', '').strip()
        province = row.get('จังหวัด', '').strip()
        postal = str(row.get('รหัสไปรษณี', '')).strip()
        
        # Try to parse if fields are empty
        parsed = parse_thai_address(full_address)
        
        if not subdistrict and parsed['subdistrict']:
            subdistrict = clean_address_component(parsed['subdistrict'], 'subdistrict')
        if not district and parsed['district']:
            district = clean_address_component(parsed['district'], 'district')
        if not province and parsed['province']:
            province = clean_address_component(parsed['province'], 'province')
        if not postal and parsed['zipcode']:
            postal = parsed['zipcode']
            
        # Bangkok special cases clean up
        if 'กทม' in province or 'กรุงเทพ' in province:
             province = "กรุงเทพมหานคร"
             # Ensure district has "เขต" if missing (optional but good for consistency)
             # Ensure subdistrict has "แขวง" if missing
        
        product_code = row.get('', '') 
        product_name = row.get('สินค้า', '').strip()
        
        quantity = row.get('จำนวน', '1')
        price = parse_price(row.get('ราคา', '0'))
        
        salesperson = row.get('พนักงานขาย', '').strip()
        payment = normalize_payment(row.get('ชำระเงิน', ''))
        
        # Calculate line total
        try:
            qty = float(quantity) if quantity else 1
            unit_price = float(price) / qty if qty > 0 else float(price)
            line_total = float(price)
        except:
            qty = 1
            unit_price = 0
            line_total = 0
        
        out_row = {
            "วันที่ขาย": sale_date_parsed,
            "วันที่จัดส่ง": sale_date_parsed,
            "ชื่อลูกค้า": first_name,
            "นามสกุลลูกค้า": last_name,
            "เบอร์โทรลูกค้า": phone,
            "อีเมลลูกค้า": "",
            "แขวง/ตำบลจัดส่ง": subdistrict,
            "เขต/อำเภอจัดส่ง": district,
            "จังหวัดจัดส่ง": province,
            "รหัสไปรษณีย์จัดส่ง": postal,
            "ที่อยู่จัดส่ง": full_address,
            "รหัสสินค้า": product_code,
            "ชื่อสินค้า": product_name,
            "จำนวน": str(int(qty)),
            "ราคาต่อหน่วย": str(round(unit_price, 2)),
            "ส่วนลด": "0",
            "ยอดรวมรายการ": str(round(line_total, 2)),
            "รหัสพนักงานขาย": salesperson,
            "รหัสผู้ดูแล": "",
            "วิธีชำระเงิน": payment,
            "หมายเหตุคำสั่งซื้อ": ""
        }
        rows_out.append(out_row)

# Write output
with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=output_headers, quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(rows_out)

print(f"Converted {len(rows_out)} rows to {output_file}")
print("Done!")
