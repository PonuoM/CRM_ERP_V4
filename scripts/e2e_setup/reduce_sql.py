import sys
import os

input_file = "api/migrations/primacom_mini_erp (19).sql"
output_file = "api/migrations/primacom_mini_erp_test_reduced.sql"

if not os.path.exists(input_file):
    print(f"Error: {input_file} not found")
    sys.exit(1)

customer_insert_count = 0
MAX_CUSTOMER_INSERTS = 100 # Adjust this to get roughly 50k rows. If each insert has ~500 rows, 100 inserts = 50,000 rows.

print(f"Reading {input_file} and filtering `customers` inserts...")

with open(input_file, 'r', encoding='utf8', errors='ignore') as f_in:
    with open(output_file, 'w', encoding='utf8') as f_out:
        for line in f_in:
            if line.startswith("INSERT INTO `customers`"):
                if customer_insert_count < MAX_CUSTOMER_INSERTS:
                    f_out.write(line)
                    customer_insert_count += 1
            else:
                f_out.write(line)

print(f"Done. Kept {customer_insert_count} INSERT statements for `customers`.")
print(f"Output saved to {output_file}")
