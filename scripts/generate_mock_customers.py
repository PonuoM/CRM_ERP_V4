import random
import datetime

# Configuration
NUM_RECORDS = 10000
ASSIGNED_TO = 1655
COMPANY_ID = 1
OUTPUT_FILE = 'c:/AppServ/www/CRM_ERP_V4/exemple_import/mock_customers_1655.sql'

# Data Lists
FIRST_NAMES = ["Somchai", "Somsak", "Malee", "Wipa", "Arthit", "Naree", "Prasit", "Siriporn", "Anan", "Boonsri", "Chai", "Dao", "Ekkachai", "Fah", "Gam", "Hathai", "Intira", "Jiraporn", "Kanya", "Lek"]
LAST_NAMES = ["Jaidee", "Rakchart", "Sukjai", "Mungmee", "Kongthai", "Dee-mark", "Srisuk", "Wongsa", "Charoen", "Saelee", "Saewang", "Kaewta", "Ngam-ta", "Suwannaphum", "Rattanaphan", "Phosri", "Jantaro"]
PROVINCES = ["Bangkok", "Chiang Mai", "Khon Kaen", "Phuket", "Chonburi", "Nakhon Ratchasima", "Songkhla", "Udon Thani", "Surat Thani", "Ubon Ratchathani"]
DISTRICTS = ["Muang", "Bang Lamung", "Hat Yai", "Mae Rim", "Kathu", "Pak Chong", "Sichon", "Warin Chamrap"]
SUBDISTRICTS = ["Tambon 1", "Tambon 2", "Tambon 3", "Nai Mueang", "Nong Hoi", "Patong", "Hua Hin"]
LIFECYCLE_STATUSES = ["New", "Old", "FollowUp", "Old3Months", "DailyDistribution"]
BEHAVIORAL_STATUSES = ["Hot", "Warm", "Cold", "Frozen"]
GRADES = ["A", "B", "C", "D", "A+"]

def generate_phone():
    return f"0{random.randint(8,9)}{random.randint(0,9)}{random.randint(1000000, 9999999)}"

def generate_date(start_year=2024, end_year=2025):
    start_date = datetime.date(start_year, 1, 1)
    end_date = datetime.date(end_year, 12, 31)
    time_between_dates = end_date - start_date
    days_between_dates = time_between_dates.days
    random_number_of_days = random.randrange(days_between_dates)
    random_date = start_date + datetime.timedelta(days=random_number_of_days)
    return random_date.strftime("%Y-%m-%d %H:%M:%S")

def main():
    print(f"Generating {NUM_RECORDS} mock customers...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        # Columns based on db_structure.txt
        columns = [
            "`company_id`", "`customer_ref_id`", "`first_name`", "`last_name`", "`phone`", 
            "`email`", "`street`", "`subdistrict`", "`district`", "`province`", "`postal_code`", 
            "`assigned_to`", "`date_assigned`", "`lifecycle_status`", "`behavioral_status`", 
            "`grade`", "`total_purchases`", "`total_calls`", "`is_blocked`"
        ]
        
        f.write(f"INSERT INTO `customers` ({', '.join(columns)}) VALUES \n")
        
        values_list = []
        for i in range(NUM_RECORDS):
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            phone = generate_phone()
            # customer_ref_id must be unique, using same pattern as previous code but mapped to correct column
            customer_ref_id = f"CUS-MOCK-{ASSIGNED_TO}-{i+1:05d}"
            street = f"{random.randint(1, 999)}/{random.randint(1, 99)} Moo {random.randint(1, 15)}"
            province = random.choice(PROVINCES)
            district = random.choice(DISTRICTS)
            subdistrict = random.choice(SUBDISTRICTS)
            postal_code = f"{random.randint(10, 96)}{random.randint(100, 999)}"
            
            behavioral_status = random.choice(BEHAVIORAL_STATUSES)
            lifecycle_status = random.choice(LIFECYCLE_STATUSES)
            grade = random.choice(GRADES)
            
            total_purchases = random.randint(0, 50000)
            total_calls = random.randint(0, 20)
            
            date_assigned = generate_date()
            
            # Construct the value tuple
            value = f"({COMPANY_ID}, '{customer_ref_id}', '{first_name}', '{last_name}', '{phone}', NULL, '{street}', '{subdistrict}', '{district}', '{province}', '{postal_code}', {ASSIGNED_TO}, '{date_assigned}', '{lifecycle_status}', '{behavioral_status}', '{grade}', {total_purchases}, {total_calls}, 0)"
            values_list.append(value)
            
            if (i + 1) % 1000 == 0:
                print(f"Generated {i + 1} records...")

        f.write(",\n".join(values_list))
        f.write(";\n")

    print(f"Done! File saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
