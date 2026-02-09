<?php
require_once '../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "No data provided."]);
    exit();
}

$conn = db_connect();
$action = $data->action ?? '';

try {
    $conn->beginTransaction();

    if ($action === 'create') {
        $sql = "INSERT INTO products (sku, name, description, category, unit, cost, price, stock, company_id, shop, ads_group, status) VALUES (:sku, :name, :description, :category, :unit, :cost, :price, :stock, :company_id, :shop, :ads_group, 'Active')";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':sku', $data->sku);
        $stmt->bindParam(':name', $data->name);
        $stmt->bindParam(':description', $data->description);
        $stmt->bindParam(':category', $data->category);
        $stmt->bindParam(':unit', $data->unit);
        $stmt->bindParam(':cost', $data->cost);
        $stmt->bindParam(':price', $data->price);
        $stmt->bindParam(':stock', $data->stock);
        $stmt->bindParam(':company_id', $data->companyId);
        $stmt->bindParam(':shop', $data->shop);
        $adsGroup = $data->adsGroup ?? null;
        $stmt->bindParam(':ads_group', $adsGroup);
        
        if ($stmt->execute()) {
            $productId = $conn->lastInsertId();
            
            // Handle Lots
            if (isset($data->lots) && is_array($data->lots)) {
                foreach ($data->lots as $lot) {
                    $lotSql = "INSERT INTO product_lots (lot_number, product_id, warehouse_id, quantity_received, quantity_remaining, purchase_date, expiry_date, unit_cost, notes, status) VALUES (:lot_number, :product_id, :warehouse_id, :quantity, :quantity, :purchase_date, :expiry_date, :unit_cost, :notes, 'Active')";
                    $lotStmt = $conn->prepare($lotSql);
                    $lotStmt->bindParam(':lot_number', $lot->lotNumber);
                    $lotStmt->bindParam(':product_id', $productId);
                    $lotStmt->bindParam(':warehouse_id', $lot->warehouseId);
                    $lotStmt->bindParam(':quantity', $lot->quantity);
                    $lotStmt->bindParam(':purchase_date', $lot->purchaseDate);
                    $expiry = !empty($lot->expiryDate) ? $lot->expiryDate : null;
                    $lotStmt->bindParam(':expiry_date', $expiry);
                    $lotStmt->bindParam(':unit_cost', $lot->unitCost);
                    $lotStmt->bindParam(':notes', $lot->notes);
                    $lotStmt->execute();
                }
            }
            
            $conn->commit();
            echo json_encode(["success" => true, "message" => "Product created successfully.", "id" => $productId]);
        } else {
            throw new Exception("Failed to create product.");
        }

    } elseif ($action === 'update') {
        if (!isset($data->id)) {
            throw new Exception("Product ID is required for update.");
        }

        $sql = "UPDATE products SET sku = :sku, name = :name, description = :description, category = :category, unit = :unit, cost = :cost, price = :price, stock = :stock, shop = :shop, ads_group = :ads_group WHERE id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':sku', $data->sku);
        $stmt->bindParam(':name', $data->name);
        $stmt->bindParam(':description', $data->description);
        $stmt->bindParam(':category', $data->category);
        $stmt->bindParam(':unit', $data->unit);
        $stmt->bindParam(':cost', $data->cost);
        $stmt->bindParam(':price', $data->price);
        $stmt->bindParam(':stock', $data->stock);
        $stmt->bindParam(':shop', $data->shop);
        $adsGroup = $data->adsGroup ?? null;
        $stmt->bindParam(':ads_group', $adsGroup);
        $stmt->bindParam(':id', $data->id);
        
        if ($stmt->execute()) {
            // Handle Lots
            if (isset($data->lots) && is_array($data->lots)) {
                foreach ($data->lots as $lot) {
                    if (isset($lot->id)) {
                        // Update existing lot
                        $lotSql = "UPDATE product_lots SET lot_number = :lot_number, warehouse_id = :warehouse_id, quantity_remaining = :quantity, purchase_date = :purchase_date, expiry_date = :expiry_date, unit_cost = :unit_cost, notes = :notes WHERE id = :id";
                        $lotStmt = $conn->prepare($lotSql);
                        $lotStmt->bindParam(':id', $lot->id);
                    } else {
                        // Insert new lot
                        $lotSql = "INSERT INTO product_lots (lot_number, product_id, warehouse_id, quantity_received, quantity_remaining, purchase_date, expiry_date, unit_cost, notes, status) VALUES (:lot_number, :product_id, :warehouse_id, :quantity, :quantity, :purchase_date, :expiry_date, :unit_cost, :notes, 'Active')";
                        $lotStmt = $conn->prepare($lotSql);
                        $lotStmt->bindParam(':product_id', $data->id);
                    }
                    
                    $lotStmt->bindParam(':lot_number', $lot->lotNumber);
                    $lotStmt->bindParam(':warehouse_id', $lot->warehouseId);
                    $lotStmt->bindParam(':quantity', $lot->quantity);
                    $lotStmt->bindParam(':purchase_date', $lot->purchaseDate);
                    $expiry = !empty($lot->expiryDate) ? $lot->expiryDate : null;
                    $lotStmt->bindParam(':expiry_date', $expiry);
                    $lotStmt->bindParam(':unit_cost', $lot->unitCost);
                    $lotStmt->bindParam(':notes', $lot->notes);
                    $lotStmt->execute();
                }
            }
            
            $conn->commit();
            echo json_encode(["success" => true, "message" => "Product updated successfully."]);
        } else {
            throw new Exception("Failed to update product.");
        }

    } elseif ($action === 'delete') {
        if (!isset($data->id)) {
            throw new Exception("Product ID is required for delete.");
        }

        // Soft delete with timestamp
        $sql = "UPDATE products SET status = 'Inactive', deleted_at = NOW() WHERE id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $data->id);
        
        if ($stmt->execute()) {
            $conn->commit();
            echo json_encode(["success" => true, "message" => "Product deleted successfully."]);
        } else {
            throw new Exception("Failed to delete product.");
        }

    } else {
        throw new Exception("Invalid action.");
    }

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error: " . $e->getMessage()]);
}
?>
