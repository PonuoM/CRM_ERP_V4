-- Migration: 047_create_company_geo_roles
-- Description: Creates a many-to-many table mapping companies to roles for geo-fencing requirements

CREATE TABLE IF NOT EXISTS company_geo_roles (
  company_id INT NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, role_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Remove the old global require_geofencing column since we are moving to per-company settings
-- Note: Wrapping in TRY/CATCH equivalent for safe removal if exists
SET @exist := (SELECT count(*) FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'require_geofencing' AND table_schema = DATABASE());
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE roles DROP COLUMN require_geofencing', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
