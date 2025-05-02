const express = require("express");
const router = express.Router();
const pool = require("../db");
const format = require("pg-format");


const query_addInstitution = `WITH new_institution AS (INSERT INTO Institution (Name_, Field, City, Email, Type_)
                              VALUES ($1, $2, $3, $4, $5) RETURNING ID)
                              INSERT INTO %I (ID, %I) SELECT ID, $6 FROM new_institution;`;
const query_remInstitution = `DELETE FROM Institution WHERE ID = (SELECT ID FROM Institution WHERE Name_ = $1 LIMIT 1) RETURNING *;`;
const query_seeStdApdHist = `SELECT * FROM Internship_Application WHERE StdID = (SELECT ID FROM Student WHERE Name_ = $1 LIMIT 1);`;
const query_seeStdPrgHist = `SELECT * FROM Internship_Progress WHERE StdID = (SELECT ID FROM Student WHERE Name_ = $1 LIMIT 1);`;
const query_seeStdPrf = `SELECT * FROM Student WHERE Name_ = $1;`;

// Add Institution (University or College)
// Expects InstName, Field, City, Email, Type, ExtraField from frontend
router.post("/add-institution", async (req, res) => {
    const { InstName, Field, City, Email, Type, ExtraField } = req.body;
    try {
        let tableName, columnName;
        if (Type === 'University') {
            tableName = 'University';
            columnName = 'No_of_Dept';
        } else if (Type === 'College') {
            tableName = 'College';
            columnName = 'Domains_Offered';
        } else {
            return res.status(400).json({ message: "Invalid Institution Type" });
        }

        // Format query safely
        const finalQuery = format(query_addInstitution, tableName, columnName);

        const result = await pool.query(finalQuery, [InstName, Field, City, Email, Type, ExtraField]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Remove Institution (University or College)
// Expects InstName from frontend
router.delete("/remove-institution", async (req, res) => {
    const { InstName } = req.body;
    try {
        const result = await pool.query(query_remInstitution, [InstName]);

        if (result.rowCount === 0)
            return res.status(404).json({ message: "Institution not found with this name" });
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

module.exports = router;