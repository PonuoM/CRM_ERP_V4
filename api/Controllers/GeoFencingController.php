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
            $stmt = $pdo->query('SELECT id, name, enable_geofencing, geo_window_start, geo_window_end, geo_window_days, geo_logout_time FROM companies ORDER BY name ASC');
            $companies = $stmt->fetchAll();

            $stmt = $pdo->query('SELECT company_id, work_location_id FROM company_work_locations');
            $cwl = $stmt->fetchAll();

            $stmt = $pdo->query('SELECT company_id, role_id FROM company_geo_roles');
            $cgr = $stmt->fetchAll();

            $companyMap = [];
            foreach ($companies as $c) {
                $c['enable_geofencing'] = (int)$c['enable_geofencing'];
                $c['work_location_ids'] = [];
                $c['geo_role_ids'] = [];
                $companyMap[$c['id']] = $c;
            }

            foreach ($cwl as $link) {
                if (isset($companyMap[$link['company_id']])) {
                    $companyMap[$link['company_id']]['work_location_ids'][] = (int)$link['work_location_id'];
                }
            }

            foreach ($cgr as $link) {
                if (isset($companyMap[$link['company_id']])) {
                    $companyMap[$link['company_id']]['geo_role_ids'][] = (int)$link['role_id'];
                }
            }

            // Fetch every active user per company (role resolved the same way the login
            // check does: joined by name). The client filters by the ticked geo roles,
            // so newly ticked roles show their members instantly without a refetch.
            // Includes subordinate count as a hint and the per-user exempt flag so the
            // UI can let admins exempt individuals (e.g. seniors without subordinates).
            foreach (array_values($companyMap) as $c) {
                $companyMap[$c['id']]['geo_members'] = [];
            }
            $memberSql = "
                SELECT u.id, u.username, u.first_name, u.last_name, u.company_id,
                       r.id AS role_id, r.name AS role_name,
                       COALESCE(u.exempt_geofencing, 0) AS exempt_geofencing,
                       (SELECT COUNT(*) FROM users sub
                          WHERE sub.supervisor_id = u.id AND sub.status = 'active') AS subordinates
                FROM users u
                JOIN roles r ON u.role = r.name
                WHERE u.status = 'active'
                ORDER BY u.company_id, r.id, subordinates DESC, u.first_name ASC";
            foreach ($pdo->query($memberSql)->fetchAll() as $m) {
                if (isset($companyMap[$m['company_id']])) {
                    $companyMap[$m['company_id']]['geo_members'][] = [
                        'id' => (int)$m['id'],
                        'username' => $m['username'],
                        'name' => trim($m['first_name'] . ' ' . $m['last_name']),
                        'role_id' => (int)$m['role_id'],
                        'role_name' => $m['role_name'],
                        'subordinates' => (int)$m['subordinates'],
                        'exempt_geofencing' => (int)$m['exempt_geofencing'],
                    ];
                }
            }

            // Also fetch available active roles
            $stmt = $pdo->query('SELECT id, name FROM roles WHERE is_active = 1 ORDER BY name ASC');
            $roles = $stmt->fetchAll();

            json_response([
                'ok' => true, 
                'data' => array_values($companyMap),
                'roles' => $roles
            ]);
        } else if ($method === 'POST' && $id === 'update') {
            // Update company settings
            if (!isset($in['company_id'])) {
                json_response(['ok' => false, 'error' => 'Missing company_id'], 400);
            }
            $companyId = (int)$in['company_id'];
            $enableGeofencing = isset($in['enable_geofencing']) ? (int)$in['enable_geofencing'] : 0;
            $workLocationIds = $in['work_location_ids'] ?? [];

            // Optional geo window (skip-check hours). Only touched when the keys
            // are present in the payload, so older clients that do not send them
            // (e.g. when just ticking a role) cannot wipe a saved window.
            // Empty string clears the value.
            $winSet = '';
            $winParams = [];
            if (array_key_exists('geo_window_start', $in)) {
                $winSet .= ', geo_window_start = ?';
                $winParams[] = $in['geo_window_start'] !== '' ? $in['geo_window_start'] : null;
            }
            if (array_key_exists('geo_window_end', $in)) {
                $winSet .= ', geo_window_end = ?';
                $winParams[] = $in['geo_window_end'] !== '' ? $in['geo_window_end'] : null;
            }
            if (array_key_exists('geo_window_days', $in)) {
                $winSet .= ', geo_window_days = ?';
                $winParams[] = preg_match('/^[01]{7}$/', (string)$in['geo_window_days']) ? $in['geo_window_days'] : null;
            }
            if (array_key_exists('geo_logout_time', $in)) {
                $winSet .= ', geo_logout_time = ?';
                $winParams[] = $in['geo_logout_time'] !== '' ? $in['geo_logout_time'] : null;
            }

            $pdo->beginTransaction();
            try {
                // Update companies table
                $stmt = $pdo->prepare('UPDATE companies SET enable_geofencing = ?' . $winSet . ' WHERE id = ?');
                $stmt->execute(array_merge([$enableGeofencing], $winParams, [$companyId]));

                // Update company_work_locations mapping
                $stmt = $pdo->prepare('DELETE FROM company_work_locations WHERE company_id = ?');
                $stmt->execute([$companyId]);

                if (!empty($workLocationIds) && is_array($workLocationIds)) {
                    $insertStmt = $pdo->prepare('INSERT INTO company_work_locations (company_id, work_location_id) VALUES (?, ?)');
                    foreach ($workLocationIds as $locId) {
                        $insertStmt->execute([$companyId, (int)$locId]);
                    }
                }

                // Update company_geo_roles mapping
                $geoRoleIds = $in['geo_role_ids'] ?? [];
                $stmt = $pdo->prepare('DELETE FROM company_geo_roles WHERE company_id = ?');
                $stmt->execute([$companyId]);

                if (!empty($geoRoleIds) && is_array($geoRoleIds)) {
                    $insertRoleStmt = $pdo->prepare('INSERT INTO company_geo_roles (company_id, role_id) VALUES (?, ?)');
                    foreach ($geoRoleIds as $roleId) {
                        $insertRoleStmt->execute([$companyId, (int)$roleId]);
                    }
                }

                $pdo->commit();
                json_response(['ok' => true, 'message' => 'Company settings updated']);
            } catch (Exception $e) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'Database error', 'message' => $e->getMessage()], 500);
            }
        } else if ($method === 'POST' && $id === 'toggle_exempt') {
            // Exempt (or re-include) a single user from geo-fencing
            if (!isset($in['user_id'])) {
                json_response(['ok' => false, 'error' => 'Missing user_id'], 400);
            }
            $userId = (int)$in['user_id'];
            $exempt = !empty($in['exempt']) ? 1 : 0;
            $stmt = $pdo->prepare('UPDATE users SET exempt_geofencing = ? WHERE id = ?');
            $stmt->execute([$exempt, $userId]);
            json_response(['ok' => true, 'user_id' => $userId, 'exempt_geofencing' => $exempt]);
        } else {
            json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
        }
    }
}
