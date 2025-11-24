
filename = r"c:/AppServ/www/CRM_ERP_V4/mini_erp (15).sql"
search_terms = ["trg_validate_order_creator"]

try:
    with open(filename, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            for term in search_terms:
                if term in line:
                    print(f"{i}: {line.strip()[:100]}")
except Exception as e:
    print(f"Error: {e}")
