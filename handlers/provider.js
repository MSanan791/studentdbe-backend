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
    const { name_, type_, email, website, field } = req.body;
  
    try {
      // Insert data into Internship_Provider table without specifying the ID
      const result = await pool.query(
        `INSERT INTO Internship_Provider (Name_, Type_, Email, Website, Field)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name_, type_, email, website, field]
      );
  
      // Return the newly added provider data
      res.status(201).json(result.rows[0]);
  
    } catch (err) {
      console.error("Error in /add-provider:", err);
      res.status(500).json({ error: "Failed to add provider" });
    }
  });
  

// Remove Provider
// Expects ProviderName from frontend
// Remove Provider
// Expects ProviderName from frontend
// Remove Provider (By ID)
router.delete("/remove-provider/:id", async (req, res) => {
    const { id } = req.params;  // Expecting ID from the frontend
    console.log(id);  // Log the id to ensure it's passed correctly
    if (!id) {
        return res.status(400).json({ message: "ID parameter is missing" });
    }
    try {
        const result = await pool.query("DELETE FROM Internship_Provider WHERE ID = $1 RETURNING *", [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Provider not found" });
        } else {
            res.status(200).json({ message: "Provider removed successfully", deletedProvider: result.rows[0] });
        }
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

router.get("/search-internship-Track", async (req, res) => {
  const { stdid, intshpid, status_, startdate, enddate } = req.query;

  try {
      let query = 'SELECT * FROM internship_progress WHERE 1=1';
      let queryParams = [];

      // Dynamically add conditions based on provided query parameters
      if (stdid !== undefined) {
          query += ' AND stdid = $' + (queryParams.length + 1);
          queryParams.push(stdid);
      }
      if (intshpid !== undefined) {
          query += ' AND intshpid = $' + (queryParams.length + 1);
          queryParams.push(intshpid);
      }
      if (status_ !== undefined) {
          query += ' AND status_ = $' + (queryParams.length + 1);
          queryParams.push(status_);
      }
      if (startdate !== undefined) {
          query += ' AND startdate >= $' + (queryParams.length + 1);
          queryParams.push(startdate);
      }
      if (enddate !== undefined) {
          query += ' AND enddate <= $' + (queryParams.length + 1);
          queryParams.push(enddate);
      }

      // If no filters are provided, fetch all internship progress records
      if (queryParams.length === 0) {
          query = 'SELECT * FROM internship_progress ORDER BY id;';
      }

      // Execute the query
      const result = await pool.query(query, queryParams);

      res.json(result.rows); // Send back the results
  } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
  }
});

router.put("/update-internship-Track/:id", async (req, res) => {
    const { status_, startdate, enddate } = req.body;
    const { id } = req.params; // Extract the id from the route parameters

    try {
        const result = await pool.query(
            `UPDATE Internship_Progress SET Status_ = $1, StartDate = $2, EndDate = $3 WHERE ID = $4 RETURNING *`,
            [status_, startdate, enddate, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Internship progress not found" });
        }

        res.json(result.rows[0]); // Return the updated row
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update internship progress" });
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

router.get("/get-providers", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM Internship_Provider order by id");
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch providers" });
    }
  });
  
  router.put("/update-provider/:id", async (req, res) => {
    const { name_, type_, email, website, field } = req.body;
    const { id } = req.params; // ✅ Extract the id from the route parameters
    try {
      const result = await pool.query(
        `UPDATE Internship_Provider SET Name_ = $1, Type_ = $2, Email = $3, Website = $4, Field = $5 WHERE ID = $6 RETURNING *`,
        [name_, type_, email, website, field, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json(result.rows[0]); // ✅ Return the updated row
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update provider" });
    }
  });
  

module.exports = router;