const express = require("express");
const router = express.Router();
const pool = require("../db");
const format = require("pg-format");


const query_addInstitution = `WITH new_institution AS (INSERT INTO Institution (Name_, Field, City, Email, Type_)
                              VALUES ($1, $2, $3, $4, $5) RETURNING ID)
                              INSERT INTO %I (ID, %I) SELECT ID, $6 FROM new_institution;`;
const query_remInstitution = `DELETE FROM Institution WHERE ID = $1 RETURNING *;`;
const query_seeStdApdHist = `SELECT * FROM Internship_Application WHERE StdID = (SELECT ID FROM Student WHERE Name_ = $1 LIMIT 1);`;
const query_seeStdPrgHist = `SELECT * FROM Internship_Progress WHERE StdID = (SELECT ID FROM Student WHERE Name_ = $1 LIMIT 1);`;
const query_seeStdPrf = `SELECT * FROM Student WHERE Name_ = $1;`;

// Add Institution (University or College)
// Expects InstName, Field, City, Email, Type, ExtraField from frontend
//  // make sure this is imported at the top

// Expects: name_, field, city, email, type_, extraField from frontend
router.post("/add-institution", async (req, res) => {
    const { name_, field, city, email, type_ } = req.body;

    try {
        // Insert the data into the Institution table
        const result = await pool.query(
            `INSERT INTO Institution (Name_, Field, City, Email, Type_)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *;`, 
            [name_, field, city, email, type_]
        );

        // Send a response with the inserted institution
        res.json({ message: "Institution added successfully", insertedInstitution: result.rows[0] });
    } catch (err) {
        console.error("Error adding institution:", err);
        res.status(500).send("Server Error");
    }
});



// Remove Institution (University or College)
// Expects InstName from frontend
router.delete("/remove-institution/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(query_remInstitution, [id]);

        if (result.rowCount === 0)
            return res.status(404).json({ message: "Institution not found with this id" });
        else
            res.status(200).json({ message: "Institution removed successfully", deletedInstitution: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// See applied internships history of a student
// Expects StdName from frontend in URL
router.get("/search-stdApphistory", async (req, res) => {
    const { StdName } = req.query;
    try {
        const result = await pool.query(query_seeStdApdHist, [StdName]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// See done/doing internship history of a student
// Expects StdName from frontend in URL
router.get("/search-stdPrghistory", async (req, res) => {
    const { StdName } = req.query;
    try {
        const result = await pool.query(query_seeStdPrgHist, [StdName]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// See student profile
// Expects StdName from frontend in URL
router.get("/search-stdProfile", async (req, res) => {
    console.log("search-stdProfile");
    const { StdName } = req.query;
    try {
        const result = await pool.query(query_seeStdPrf, [StdName]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

router.get("/get-institution", async (req, res) => {
    // const { InstName } = req.query;
    try {
        const result = await pool.query("SELECT * FROM Institution order by id");
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Institution not found" });
        }
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


module.exports = router;