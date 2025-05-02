const express = require("express");
const router = express.Router();
const pool = require("../db");

const query_addStd = `WITH inst AS (SELECT ID as inst_id FROM institution WHERE name_ = $1 LIMIT 1)
                      INSERT INTO student (Name_, Field_of_Interest, DoB, City, Email, ContactNo, InstID)
                      VALUES ($2, $3, $4, $5, $6, $7, (SELECT inst_id FROM inst));`
const query_remStd = `delete from Student where ID = (Select ID from Student where Name_ = $1 Limit 1) Returning *`
const query_applyIntshp = `INSERT INTO Internship_Application (Status_, AppliedDate, StdID, IntshpID)
                           VALUES ('Applied', 
                                   CURRENT_DATE, 
                                   (SELECT ID FROM student WHERE Name_ = $1), 
                                   (SELECT ID FROM Internship WHERE Title = $2));`
const query_srchIntshp = `select * from Internship where Field = $1;`
const query_histAppld = `Select * from Internship_Application where StdID = (Select ID from Student where Name_ = $1 Limit 1);`
const query_histPrgrs = `Select * from Internship_Progress where StdID = (Select ID from Student where Name_ = $1 Limit 1);`

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
router.delete("/remove-student", async (req, res) => {
    const { StdName } = req.body;
    try {
        const result = await pool.query(query_remStd, [StdName]);

        if (result.rowCount === 0)
            return res.status(404).json({ message: "Student not found with this name" });
        else
            res.status(200).json({ message: "Student removed successfully", deletedStudent: result.rows[0]});
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

//Search for available internships (filtered by required field)
// Expects Field from frontEnd in the URL
router.get("/search-internshipByField", async (req, res) => {
    const { field } = req.query;
    try {
        const result = await pool.query(query_srchIntshp, [field]);
    res.json(result.rows);
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

module.exports = router;