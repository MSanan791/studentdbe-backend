const express = require("express");
const router = express.Router();
const pool = require("../db");
const format = require("pg-format");

const query_addProvider = ` WITH new_provider AS (INSERT INTO Internship_Provider (Name_, Type_, Email, Website, Field)
                            VALUES ($1, $2, $3, $4, $5) RETURNING ID)
                            INSERT INTO %I (ID, %s) VALUES ( (SELECT ID FROM new_provider), %L );`;
                            
const query_remProvider = `DELETE FROM Internship_Provider WHERE ID = (SELECT ID FROM Internship_Provider WHERE Name_ = $1 LIMIT 1) RETURNING *;`;
const query_postInternship = `INSERT INTO Internship (Title, Field, Description_, StartDate, EndDate, Duration, Max_Slots, Prv_ID)
                              VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT ID FROM Internship_Provider WHERE Name_ = $8 LIMIT 1))
                              RETURNING *;`;
const query_reviewApplications = `SELECT * FROM Internship_Application WHERE IntshpID = $1;`;
const query_acptApplication = `WITH application_data AS (SELECT StdID, IntshpID FROM Internship_Application WHERE ID = $1),
                                    internship_data AS (SELECT StartDate, EndDate FROM Internship WHERE ID = (SELECT IntshpID FROM application_data))
                               INSERT INTO Internship_Progress (StartDate, EndDate, Status_, StdID, IntshpID)
                               SELECT (SELECT StartDate FROM internship_data),
                                      (SELECT EndDate FROM internship_data),
                                      'Accepted',
                                      (SELECT StdID FROM application_data),
                                      (SELECT IntshpID FROM application_data);`
const query_acptApplication2 = `DELETE FROM Internship_Application WHERE ID = $1;`
const query_rjctApplicaiton = `UPDATE Internship_Application SET Status_ = 'Rejected' WHERE ID = $1 RETURNING *;`
const query_seeStdHist = `SELECT s.*, inp.*, inshp.Title, inshp.Max_Slots
                          FROM Student s
                          JOIN Internship_Progress inp ON s.ID = inp.StdID
                          JOIN Internship inshp ON inshp.ID = inp.IntshpID
                          JOIN Internship_Provider ipv ON ipv.ID = inshp.Prv_ID
                          WHERE ipv.Name_ = $1;`


// Add Provider (Company, Lab, Professor)
// Expects Type, Name, Email, Website, Field, and additional fields based on type
router.post("/add-provider", async (req, res) => {
    const { Type, Name, Email, Website, Field, ExtraFields } = req.body;
    try {
        let tableName, columnNames, columnValues;

        if (Type === 'Company') {
            tableName = 'Company';
            columnNames = 'Size';
            columnValues = ExtraFields.Size;
        } else if (Type === 'Lab') {
            tableName = 'Lab';
            columnNames = 'Supervisor, Capacity, Funding_Src, Afltd_Uni';
            columnValues = [
                ExtraFields.Supervisor,
                ExtraFields.Capacity,
                ExtraFields.Funding_Src,
                ExtraFields.Afltd_Uni
            ];
        } else if (Type === 'Professor') {
            tableName = 'Professor';
            columnNames = 'Experience, Research_Interests, Publications, Uni_ID';
            columnValues = [
                ExtraFields.Experience,
                ExtraFields.Research_Interests,
                ExtraFields.Publications,
                ExtraFields.Uni_ID
            ];
        } else {
            return res.status(400).json({ message: "Invalid Provider Type" });
        }

        // Format final query safely
        const finalQuery = `
            WITH new_provider AS (
                INSERT INTO Internship_Provider (Name_, Type_, Email, Website, Field)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING ID
            )
            INSERT INTO ${tableName} (ID, ${columnNames})
            VALUES ((SELECT ID FROM new_provider), ${columnValues.map((_, i) => `$${i + 6}`).join(', ')})
            RETURNING *;
            `;

        const params = [Name, Type, Email, Website, Field, ...columnValues];
        const result = await pool.query(finalQuery, params);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Remove Provider
// Expects ProviderName from frontend
router.delete("/remove-provider", async (req, res) => {
    const { ProviderName } = req.body;
    try {
        const result = await pool.query(query_remProvider, [ProviderName]);
        if (result.rowCount === 0)
            return res.status(404).json({ message: "Provider not found with this name" });
        else
            res.status(200).json({ message: "Provider removed successfully", deletedProvider: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Post an Internship
// Expects Title, Field, Description_, StartDate, EndDate, Duration, Max_Slots, ProviderName from frontend
router.post("/post-internship", async (req, res) => {
    const { Title, Field, Description_, StartDate, EndDate, Duration, Max_Slots, ProviderName } = req.body;
    try {
        const result = await pool.query(query_postInternship, [Title, Field, Description_, StartDate, EndDate, Duration, Max_Slots, ProviderName]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Review Internship Applications
// Expects InternshipID in URL
router.get("/review-applications", async (req, res) => {
    const { InternshipID } = req.query;
    try {
        const result = await pool.query(query_reviewApplications, [InternshipID]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Accept an application
// Expects ApplicationID from frontend
router.post("/accept-application", async (req, res) => {
    const { ApplicationID } = req.body;
    try {
        await pool.query('BEGIN');

        // Insert into Internship_Progress
        await pool.query(query_acptApplication, [ApplicationID]);

        // Delete the application
        await pool.query(query_acptApplication2, [ApplicationID]);

        await pool.query('COMMIT');
        res.status(200).json({ message: "Application accepted and moved to Internship_Progress" });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Reject an application
// Expects ApplicationID from frontend
router.put("/reject-application", async (req, res) => {
    const { ApplicationID } = req.body;
    try {
        const result = await pool.query(query_rjctApplicaiton, [ApplicationID]);

        if (result.rowCount === 0)
            return res.status(404).json({ message: "Application not found" });

        res.status(200).json({
            message: "Application rejected successfully",
            application: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// See the history of students who did internships within a Provider
// Expects ProviderName from frontend in URL
router.get("/internship-history-by-provider", async (req, res) => {
    const { ProviderName } = req.query;
    try {
        const result = await pool.query(query_seeStdHist, [ProviderName]);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;