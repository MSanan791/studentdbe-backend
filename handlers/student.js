const express = require("express");
const router = express.Router();
const pool = require("../db");

const query_addStd = `WITH inst AS (SELECT ID as inst_id FROM institution WHERE name_ = $1 LIMIT 1)
                      INSERT INTO student (Name_, Field_of_Interest, DoB, City, Email, ContactNo, InstID)
                      VALUES ($2, $3, $4, $5, $6, $7, (SELECT inst_id FROM inst));`
// const query_remStd = `delete from Student where ID = (Select ID from Student where Name_ = $1 Limit 1) Returning *`
const query_applyIntshp = `INSERT INTO Internship_Application (Status_, AppliedDate, StdID, IntshpID)
                           VALUES ('Applied', 
                                   CURRENT_DATE, 
                                   (SELECT ID FROM student WHERE Name_ = $1), 
                                   (SELECT ID FROM Internship WHERE Title = $2));`
const query_srchIntshp = `select * from Internship where Field = $1;`
const query_histAppld = `Select * from Internship_Application where StdID = (Select ID from Student where Name_ = $1 Limit 1);`
const query_histPrgrs = `Select * from Internship_Progress where StdID = (Select ID from Student where Name_ = $1 Limit 1);`
const query_remStd = `DELETE FROM Student WHERE ID = $1 RETURNING *`;

router.delete("/remove-student/:id", async (req, res) => {
    const { id } = req.params; // Note: Use `req.params` for URL parameters
    try {
      const result = await pool.query(query_remStd, [id]);
      if (result.rowCount === 0)
        return res.status(404).json({ message: "Student not found with this ID" });
      res.status(200).json({ message: "Student removed successfully", deletedStudent: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  });
  
  

//To add a student in the database
// Expects InstName, StdName, Field_of_Interest, DoB, City, Email, ContactNo from frontEnd in JSON
router.post("/add-student", async (req, res) => {
    const { InstName, StdName, Field_of_Interest, DoB, City, Email, ContactNo} = req.body;
    try {
        const result = await pool.query(query_addStd, [InstName, StdName, Field_of_Interest, DoB, City, Email, ContactNo]);
        res.json(result.rows[0]);
    } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
// SQL query to get all student information
const query_getAllStudents = `SELECT * FROM student order by id;`;

// API to get all student information
router.get("/get-students", async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store'); // Disable caching
      const result = await pool.query(query_getAllStudents);
      res.json(result.rows); // Send all rows as JSON response
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  });
  
//Student applies for internship
// Expects StdName, IntshpTitle from FrontEnd in JSON
router.post("/apply-internship", async (req, res) => {
    const { StdName, IntshpTitle} = req.body;
    try {
        const result = await pool.query(query_applyIntshp, [StdName, IntshpTitle]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

//Remove Student from Database
// Expects StdName from frontEnd in JSON
// router.delete("/remove-student", async (req, res) => {
//     const { StdName } = req.body;
//     try {
//         const result = await pool.query(query_remStd, [StdName]);

//         if (result.rowCount === 0)
//             return res.status(404).json({ message: "Student not found with this name" });
//         else
//             res.status(200).json({ message: "Student removed successfully", deletedStudent: result.rows[0]});
//     } catch (err) {
//         console.error(err);
//         res.status(500).send("Server Error");
//     }
// });

//Search for available internships (filtered by required field)
// Expects Field from frontEnd in the URL
router.get("/search-internshipByField", async (req, res) => {
  const { field } = req.query;
  try {
      let result; // Declare result variable outside the if-else block
      if (field !== undefined) {
          result = await pool.query(query_srchIntshp, [field]);
      } else {
          result = await pool.query('SELECT * FROM Internship_application order by id;');
      }

      res.json(result.rows); // Use the result variable here
  } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
  }
});

//See the history of applied internships
// Expects StdName from frontEnd in the URL
router.get("/search-historyApplied", async (req, res) => {
    const { StdName } = req.query;
    try {
        const result = await pool.query(query_histAppld, [StdName]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

//See the history of done/currently doing internships
// Expects StdName from frontEnd in the URL
router.get("/search-historyProgress", async (req, res) => {
    const { StdName } = req.query;
    try {
        const result = await pool.query(query_histPrgrs, [StdName]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

router.put("/updateStudent/:id", async (req, res) => {
    const { id } = req.params;
    const { name_, field_of_interest, dob, city, email, contactno, instid } = req.body;
  
    const query1 = `
      UPDATE Student
    SET
    name_ = $1,
    field_of_interest = $2,
    dob = $3,
    city = $4,
    email = $5,
    contactno = $6,
    instid = $7
    WHERE id = $8
    RETURNING *;
    `;
  
    try {
      const result = await pool.query(query1, [
       name_, field_of_interest, dob, city, email, contactno, instid,id
      ]);
  
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Student not found with this ID" });
      }
  
      res.status(200).json({ message: "Student updated successfully", updatedStudent: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  });
  
 // PUT /api/student/update-internship-application/:id
router.put('/update-internship-application/:id', async (req, res) => {
  const { id } = req.params;
  const { status_, applieddate, stdid, intshpid, startdate, enddate } = req.body;
  console.log("Received data:", req.body); // Log the received data for debugging
  if (!status_ || !applieddate || !stdid || !intshpid || !startdate || !enddate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `WITH updated_application AS (
        UPDATE internship_application
        SET status_ = $1,
            applieddate = $2,
            stdid = $3,
            intshpid = $4
        WHERE id = $5
        RETURNING *
      )
      INSERT INTO internship_progress (startdate, enddate, status_, stdid, intshpid)
      SELECT $6, $7, 'In Progress', $3, $4
      WHERE $1 = 'Accepted'
      RETURNING *;`,
      [status_, applieddate, stdid, intshpid, id, startdate, enddate]
    );

    res.status(200).json({ message: 'Internship updated', updatedInternship: result.rows[0] });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  

module.exports = router;