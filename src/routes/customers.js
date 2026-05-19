const express = require("express");
const pool = require("../db");

const router = express.Router();

/* -------------------------------------------------------
   RENDER: CUSTOMERS LIST (HTML)
------------------------------------------------------- */
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customers ORDER BY id ASC"
    );
    res.render("customers/index", { customers: result.rows });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   RENDER: ADD CUSTOMER FORM (HTML)
------------------------------------------------------- */
router.get("/new", (req, res) => {
  res.render("customers/new");
});

/* -------------------------------------------------------
   API: GET ALL CUSTOMERS (JSON)
------------------------------------------------------- */
router.get("/api/list", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customers ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: CREATE CUSTOMER
------------------------------------------------------- */
router.post("/", async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;

    await pool.query(
      `INSERT INTO customers (name, phone, email)
       VALUES ($1, $2, $3)`,
      [name, phone, email]
    );

    res.redirect("/customers");
  } catch (err) {
    next(err);
  }
});

module.exports = router;

