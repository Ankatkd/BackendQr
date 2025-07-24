const { Sequelize } = require("sequelize");
require("dotenv").config();

// ✅ Initialize Sequelize with Aivencloud details
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306, // Ensure port is parsed as integer
    dialect: "mysql",
    dialectOptions: {
      // ✅ Aivencloud requires SSL. rejectUnauthorized: false is common for self-signed or non-verified CAs.
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    },
    logging: console.log, // Keep logging for now to see SQL queries, set to false for production
  }
);

// ✅ Test the database connection
sequelize.authenticate()
  .then(() => console.log("✅ MySQL Database Connected successfully"))
  .catch(err => console.error("❌ Database Connection Error:", err.message));

// ✅ IMPORTANT: Export as an object for consistent destructuring in other files
module.exports = { sequelize };