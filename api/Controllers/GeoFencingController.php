<?php

class GeoFencingController
{
    public static function handle_geo_locations(PDO $pdo, ?string $id)
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $in = json_decode(file_get_contents('php://input'), true) ?? [];

        switch ($method) {
            case 'GET':
                $stmt = $pdo->query('SELECT * FROM work_locations ORDER BY created_at DESC');
                $locations = $stmt->fetchAll();
                json_response(['ok' => true, 'data' => $locations]);
                break;
            case 'POST':
                if (empty($in['name']) || !isset($in['latitude']) || !isset($in['longitude']) || !isset($in['radius_meters'])) {
                    json_response(['ok' => false, 'error' => 'Missing required fields (name, latitude, longitude, radius_meters)'], 400);
                }
                $stmt = $pdo->prepare('INSERT INTO work_locations (name, latitude, longitude, radius_meters, is_active) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([
                    $in['name'],
                    $in['latitude'],
                    $in['longitude'],
                    $in['radius_meters'],
                    $in['is_active'] ?? 1
                ]);
                json_response(['ok' => true, 'id' => $pdo->lastInsertId(), 'message' => 'Location added successfully']);
                break;
            case 'PUT':
                if (!$id) {
                    json_response(['ok' => false, 'error' => 'Missing location ID'], 400);
                }
                $stmt = $pdo->prepare('UPDATE work_locations SET name = ?, latitude = ?, longitude = ?, radius_meters = ?, is_active = ? WHERE id = ?');
                $stmt->execute([
                    $in['name'],
                    $in['latitude'],
                    $in['longitude'],
                    $in['radius_meters'],
                    $in['is_active'] ?? 1,
                    $id
                ]);
                json_response(['ok' => true, 'message' => 'Location updated successfully']);
                break;
            case 'DELETE':
                if (!$id) {
                    json_response(['ok' => false, 'error' => 'Missing location ID'], 400);
                }
                // Check if used in company_work_locations
                $stmt = $pdo->prepare('SELECT COUNT(*) FROM company_work_locations WHERE work_location_id = ?');
                $stmt->execute([$id]);
                if ($stmt->fetchColumn() > 0) {
                    json_response(['ok' => false, 'error' => 'Cannot delete location because it is currently assigned to one or more companies'], 400);
                }
                $stmt = $pdo->prepare('DELETE FROM work_locations WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true, 'message' => 'Location deleted successfully']);
                break;
            default:
                json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
        }
    }

    public static function handle_geo_companies(PDO $pdo, ?string $id, ?string $action)
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $in = json_decode(file_get_contents('php://input'), true) ?? [];

        if ($method === 'GET') {
            // Fetch all companies and their geo settings
            $stmt = $pdo->query('SELECT id, name, prefix, is_active, enable_geofencing FROM companies ORDER BY name ASC');
            $companies = $stmt->fetchAll();

            $stmt = $pdo->query('SELECT company_id, work_location_id FROM company_work_locations');
            $cwl = $stmt->fetchAll();

            $companyMap = [];
            foreach ($companies as $c) {
                $c['enable_geofencing'] = (int)$c['enable_geofencing'];
                $c['work_location_ids'] = [];
                $companyMap[$c['id']] = $c;
            }

            foreach ($cwl as $link) {
                if (isset($companyMap[$link['company_id']])) {
                    $companyMap[$link['company_id']]['work_location_ids'][] = (int)$link['work_location_id'];
                }
            }

            json_response(['ok' => true, 'data' => array_values($companyMap)]);
        } else if ($method === 'POST' && $id === 'update') {
            // Update company settings
            if (!isset($in['company_id'])) {
                json_response(['ok' => false, 'error' => 'Missing company_id'], 400);
            }
            $companyId = (int)$in['company_id'];
            $enableGeofencing = isset($in['enable_geofencing']) ? (int)$in['enable_geofencing'] : 0;
            $workLocationIds = $in['work_location_ids'] ?? [];

            $pdo->beginTransaction();
            try {
                // Update companies table
                $stmt = $pdo->prepare('UPDATE companies SET enable_geofencing = ? WHERE id = ?');
                $stmt->execute([$enableGeofencing, $companyId]);

                // Update company_work_locations mapping
                $stmt = $pdo->prepare('DELETE FROM company_work_locations WHERE company_id = ?');
                $stmt->execute([$companyId]);

                if (!empty($workLocationIds) && is_array($workLocationIds)) {
                    $insertStmt = $pdo->prepare('INSERT INTO company_work_locations (company_id, work_location_id) VALUES (?, ?)');
                    foreach ($workLocationIds as $locId) {
                        $insertStmt->execute([$companyId, (int)$locId]);
                    }
                }
                $pdo->commit();
                json_response(['ok' => true, 'message' => 'Company settings updated']);
            } catch (Exception $e) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'Database error', 'message' => $e->getMessage()], 500);
            }
        } else {
            json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
        }
    }
}
