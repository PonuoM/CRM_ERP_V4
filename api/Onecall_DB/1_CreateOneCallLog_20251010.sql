-- Create Onecall_batch table
CREATE TABLE Onecall_batch (
    id INT AUTO_INCREMENT PRIMARY KEY,
    startdate DATE NOT NULL,
    enddate DATE NOT NULL,
    amount_record INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Onecall_Log table
CREATE TABLE Onecall_Log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    duration INT NOT NULL,
    localParty VARCHAR(255) NOT NULL,
    remoteParty VARCHAR(255) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    phone_telesale VARCHAR(255) NOT NULL,
    batch_id INT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES Onecall_batch(id) ON DELETE CASCADE
);