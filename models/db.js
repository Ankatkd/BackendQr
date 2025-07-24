const { Sequelize } = require("sequelize");
require("dotenv").config();

// ✅ Initialize Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    dialectOptions: {
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    },
    logging: false, // Disable query logging in production
  }
);

// ✅ Test Database Connection
sequelize.authenticate()
  .then(() => console.log("✅ MySQL Database Connected"))
  .catch(err => console.error("❌ Database Connection Error:", err));

module.exports = { sequelize };
