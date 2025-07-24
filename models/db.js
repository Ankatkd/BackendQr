const { Sequelize } = require("sequelize");
const fs = require("fs");
require("dotenv").config();

// ✅ Load SSL CA cert if DB_SSL is true
const sslOptions = process.env.DB_SSL === "true"
  ? {
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync("certs/ca.pem")
      }
    }
  : {};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    dialect: "mysql",
    dialectOptions: sslOptions,
    logging: console.log, // set to false in production
  }
);

sequelize.authenticate()
  .then(() => console.log("✅ MySQL Database Connected successfully"))
  .catch(err => console.error("❌ Database Connection Error:", err.message));

module.exports = { sequelize };
