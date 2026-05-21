const express = require("express");
const pool = require("../db");

const router = express.Router();

/* -------------------------------------------------------
   RENDER: NEW JOB FORM
------------------------------------------------------- */
router.get("/new", async (req, res, next) => {
  try {
    const customers = await pool.query(
      "SELECT id, name FROM customers ORDER BY name ASC"
    );

    const technicians = await pool.query(
      "SELECT id, name FROM technicians ORDER BY name ASC"
    );

    res.render("jobs/new", {
      customers: customers.rows,
      technicians: technicians.rows
    });
  } catch (err) {
    console.error("Error loading /jobs/new:", err);
    next(err);
  }
});

/* -------------------------------------------------------
   RENDER: JOBS DASHBOARD
------------------------------------------------------- */
router.get("/dashboard", async (req, res, next) => {
  try {
    res.render("jobs/dashboard");
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   RENDER: VIEW JOBS PAGE (HTML)
------------------------------------------------------- */
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
          j.*,
          c.name AS customer_name
       FROM jobs j
       LEFT JOIN customers c ON j.customer_id = c.id
       ORDER BY j.id DESC`
    );

    res.render("jobs/index", { jobs: result.rows });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: GET ALL JOBS (JSON)
------------------------------------------------------- */
router.get("/api/list", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
          j.*,
          c.name AS customer_name
       FROM jobs j
       LEFT JOIN customers c ON j.customer_id = c.id
       ORDER BY j.id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: GET SINGLE JOB BY ID
------------------------------------------------------- */
router.get("/api/:id", async (req, res, next) => {
  try {
    const jobId = req.params.id;

    const job = await pool.query(
      `SELECT 
          j.*,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.email AS customer_email
       FROM jobs j
       LEFT JOIN customers c ON j.customer_id = c.id
       WHERE j.id = $1`,
      [jobId]
    );

    const parts = await pool.query(
      "SELECT * FROM job_parts WHERE job_id = $1",
      [jobId]
    );

    const technicians = await pool.query(
      `SELECT jt.id, t.name, jt.minutes_worked
       FROM job_technicians jt
       JOIN technicians t ON jt.technician_id = t.id
       WHERE jt.job_id = $1`,
      [jobId]
    );

    // ⭐ FIX: Return full technician list
    const allTechnicians = await pool.query(
      "SELECT id, name FROM technicians ORDER BY name ASC"
    );

    res.json({
      job: job.rows[0],
      parts: parts.rows,
      technicians: technicians.rows,
      allTechnicians: allTechnicians.rows
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: CREATE JOB
------------------------------------------------------- */
router.post("/api", async (req, res, next) => {
  try {
    const {
      job_number,
      customer_id,
      item_type,
      brand,
      model,
      serial_number,
      fault_reported,
      status,
      is_customer_job
    } = req.body;

    const result = await pool.query(
      `INSERT INTO jobs
       (job_number, customer_id, item_type, brand, model, serial_number,
        fault_reported, status, is_customer_job)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        job_number,
        customer_id || null,
        item_type,
        brand || null,
        model || null,
        serial_number || null,
        fault_reported,
        status || "booked_in",
        is_customer_job ?? true
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: UPDATE JOB
------------------------------------------------------- */
router.patch("/api/:id", async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const fields = [];
    const values = [];
    let index = 1;

    for (const key in req.body) {
      fields.push(`${key} = $${index}`);
      values.push(req.body[key]);
      index++;
    }

    values.push(jobId);

    const result = await pool.query(
      `UPDATE jobs SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: DELETE JOB
------------------------------------------------------- */
router.delete("/api/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM jobs WHERE id = $1", [req.params.id]);
    res.json({ message: "Job deleted" });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: ADD PART TO JOB
------------------------------------------------------- */
router.post("/api/:id/parts", async (req, res, next) => {
  try {
    const { part_name, part_cost } = req.body;

    const result = await pool.query(
      `INSERT INTO job_parts (job_id, part_name, cost)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, part_name, part_cost]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ADD PART ERROR:", err);
    res.status(500).send(err.message);
  }
});


/* -------------------------------------------------------
   API: REMOVE PART FROM JOB
------------------------------------------------------- */
router.delete("/api/:id/parts/:partId", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM job_parts WHERE id = $1", [
      req.params.partId
    ]);
    res.json({ message: "Part removed" });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: ADD TECHNICIAN TIME
------------------------------------------------------- */
router.post("/api/:id/technicians", async (req, res, next) => {
  try {
    const { technician_id, minutes_worked } = req.body;

    const result = await pool.query(
      `INSERT INTO job_technicians (job_id, technician_id, minutes_worked)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, technician_id, minutes_worked]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: UPDATE TECHNICIAN TIME
------------------------------------------------------- */
router.patch("/api/:id/technicians/:techId", async (req, res, next) => {
  try {
    const { minutes_worked } = req.body;

    const result = await pool.query(
      `UPDATE job_technicians
       SET minutes_worked = $1
       WHERE id = $2
       RETURNING *`,
      [minutes_worked, req.params.techId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   API: REMOVE TECHNICIAN FROM JOB
------------------------------------------------------- */
router.delete("/api/:id/technicians/:techId", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM job_technicians WHERE id = $1", [
      req.params.techId
    ]);
    res.json({ message: "Technician removed" });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
   RENDER: JOB DETAILS PAGE SHELL
   MUST BE LAST — prevents route conflicts
------------------------------------------------------- */
router.get("/:id", async (req, res, next) => {
  try {
    res.render("jobs/show", { jobId: req.params.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
