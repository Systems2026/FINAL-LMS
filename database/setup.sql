-- Create the empty application database without dropping or altering existing data.
-- The backend creates and additively migrates application tables at startup.
-- Change this database name to match DB_NAME in the server's .env file.
CREATE DATABASE IF NOT EXISTS `snhs_lms`
  CHARACTER SET utf8mb4;
