-- Migration: 046_create_geofencing_tables
-- Description: Adds geo-fencing configuration tables and columns

-- Add require_geofencing to roles
ALTER TABLE roles 
ADD COLUMN require_geofencing TINYINT(1) DEFAULT 0;

-- Add enable_geofencing to companies
ALTER TABLE companies 
ADD COLUMN enable_geofencing TINYINT(1) DEFAULT 0;

-- Create work_locations table
CREATE TABLE IF NOT EXISTS work_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  radius_meters INT NOT NULL DEFAULT 100,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create company_work_locations table (Many-to-Many)
CREATE TABLE IF NOT EXISTS company_work_locations (
  company_id INT NOT NULL,
  work_location_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, work_location_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (work_location_id) REFERENCES work_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
