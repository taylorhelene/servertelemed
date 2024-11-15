const express =  require('express');
const app = express();
const dotenv = require("dotenv") ;
app.use(express.json()); // To parse incoming JSON requests
const cors = require('cors');
const bcrypt = require('bcrypt');
var salt = bcrypt.genSaltSync(10);


// Use CORS middleware
app.use(cors());
dotenv.config();
const port =  3000;

const username = process.env.DB_USERNAME;
const dbname = process.env.DB_NAME;
const password = process.env.DB_PASSWORD;
const localhost = process.env.DB_HOST
var mysql = require('mysql2');

var con = mysql.createConnection({
    host: localhost,
    user: username,
    password:password,
    database: dbname
  });
  
  con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
  });

  app.get("/patients", async(req, resp) => {
    con.connect(function(err) {
        if (err) throw err;
        con.query("SELECT * FROM patients", function (err, result, fields) {
          if (err) throw err;
          console.log(result);
          resp.send(result);
        });
      });
  })

  app.get("/doctors", async(req, resp) => {
    con.connect(function(err) {
        if (err) throw err;
        con.query("SELECT * FROM doctors", function (err, result, fields) {
          if (err) throw err;
          console.log(result);
          resp.send(result);
        });
      });
  })

  app.get("/admin", async(req, resp) => {
    con.connect(function(err) {
        if (err) throw err;
        con.query("SELECT * FROM admin", function (err, result, fields) {
          if (err) throw err;
          console.log(result);
          resp.send(result);
        });
      });
  })

  
  app.post("/patients", async (req, resp) => {
    const { firstname, lastname, email, phone, date_of_birth, address,gender, password } = req.body;

    // Hash the password with bcrypt (optional, if you are also doing client-side hashing)
    const hashedPassword = await bcrypt.hash(password, salt); // 10 is the salt rounds
    console.log(hashedPassword,password)

    const query = "INSERT INTO patients (first_name, last_name, email, phone, date_of_birth, address,gender, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?,?)";
    const values = [firstname, lastname, email, phone, date_of_birth, address,gender, hashedPassword]; // Hash the password as needed

    con.query(query, values, (err, result) => {
        if (err) {
            console.error("Error inserting data:", err);
            return resp.status(500).send(err);
        }
        console.log("Patient added:", result);
        resp.status(201).json({ message: "Patient signed up successfully", patientId: result.insertId });
    });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body; // Username is the email in this context

  // Query the database for the patient with the given email
  const query = 'SELECT * FROM Patients WHERE email = ?';
  con.execute(query, [username], async(err, results) => {
      if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Database error' });
      }

      // Check if a user was found
      if (results.length === 0) {
          return res.status(401).json({ message: 'Invalid username or password' });
      }

      const user = results[0];

       // Log the stored hashed password for debugging
       console.log('Stored hashed password:', user.password_hash, password);

      // Compare the incoming password with the hashed password in the database
      bcrypt.compare(password, user.password_hash, (err, match) => {
          if (err) {
              console.error(err);
              return res.status(500).json({ message: 'Error verifying password' });
          }

          // Log the comparison result
          console.log('Password match result:', match);

          
          if (match) {
              // Successful login
              // Send the user data (without password) back to the frontend
              const userData = {
                id: user.id,
                firstname: user.first_name,
                lastname: user.last_name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                date_of_birth: user.date_of_birth
            };

            res.status(200).json({ message: "Login successful", user: userData });
          } else {
              // Invalid password
              res.status(401).json({ message: 'Invalid username or password' });
          }
      });
  });
});

// Update user information
app.put('/patients/:id', async (req, res) => {
  const { id } = req.params;
  const { firstname, lastname, phone, address, date_of_birth } = req.body;

  if (!firstname || !lastname || !phone || !address || !date_of_birth) {
      return res.status(400).json({ message: "All fields are required" });
  }

  const query = `
      UPDATE patients 
      SET first_name = ?, last_name = ?, phone = ?, address = ?, date_of_birth = ?
      WHERE id = ?`;

  con.query(query, [firstname, lastname, phone, address, date_of_birth, id], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Database error', error: err });
      }
      res.status(200).json({ message: 'User information updated successfully' });
  });
});

// Delete user account
app.delete('/patients/:id', (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM patients WHERE id = ?`;

  con.query(query, [id], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Database error', error: err });
      }
      if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User account deleted successfully' });
  });
});

// Get appointments for a specific patient
app.get('/appointments', (req, res) => {
  const patientId = req.query.patient_id;

  const query = `SELECT * FROM appointments WHERE patient_id = ?`;
  con.query(query, [patientId], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Database error', error: err });
      }
      res.json(result);
  });
});

// Book an appointment
app.post('/appointments', (req, res) => {
  const { patient_id, doctor_id, appointment_date, appointment_time } = req.body;

  const query = `INSERT INTO Appointments (patient_id, doctor_id, appointment_date, appointment_time, status) 
                 VALUES (?, ?, ?, ?, 'scheduled')`;
  con.query(query, [patient_id, doctor_id, appointment_date, appointment_time], (err, result) => {
      if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
              return res.status(409).json({ message: 'Appointment slot is already booked.' });
          }
          return res.status(500).json({ message: 'Database error', error: err });
      }
      res.status(201).json({ message: 'Appointment booked successfully', appointmentId: result.insertId });
  });
});

// Cancel an appointment
app.delete('/appointments/:id', (req, res) => {
  const appointmentId = req.params.id;
  const patientId = req.body.patient_id; // Pass patient_id in the request body

  const query = `UPDATE Appointments SET status = 'canceled' WHERE id = ? AND patient_id = ?`;
  con.query(query, [appointmentId, patientId], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Database error', error: err });
      }
      if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Appointment not found or you do not have permission to cancel this appointment.' });
      }
      res.json({ message: 'Appointment canceled successfully' });
  });
});


// Doctor sign-up route
app.post('/doctor/signup', (req, res) => {
  const { firstname, lastname, specialization, email, phone, schedule } = req.body;

  // SQL query to insert the doctor into the Doctors table
  const sql = 'INSERT INTO Doctors (first_name, last_name, specialization, email, phone, schedule) VALUES (?, ?, ?, ?, ?, ?)';

  con.query(sql, [firstname, lastname, specialization, email, phone, schedule], (err, result) => {
    if (err) {
      console.error('Error saving doctor:', err);
      return res.status(500).json({ message: 'Error saving doctor to database' });
    }
    res.status(200).json({ message: 'Doctor registered successfully!' });
  });
});

// Doctor login (POST)
app.post('/doctor/login', (req, res) => {
  const { email, phone } = req.body;

  // Check if the doctor exists in the database
  const sql = 'SELECT * FROM Doctors WHERE email = ? AND phone = ?';

  con.query(sql, [email, phone], (err, results) => {
      if (err) {
          console.error('Error during doctor login:', err);
          return res.status(500).json({ message: 'Server error' });
      }

      if (results.length > 0) {
          // Successful login, send doctor info to the client
          const doctor = results[0];
          res.status(200).json({ 
              message: 'Login successful', 
              doctorId: doctor.id, 
              firstName: doctor.first_name, 
              lastName: doctor.last_name,
              phone: doctor.phone,
              specialization: doctor.specialization,
              schedule: doctor.schedule
          });
          console.log(doctor)
      } else {
          res.status(401).json({ message: 'Invalid email or phone number' });
      }
  });
});


// Fetch Doctor Details (GET)
app.get('/doctor/details', (req, res) => {
  const doctorId = req.session.doctorId;  // Get doctor ID from session

  if (!doctorId) {
      return res.status(401).json({ message: 'Unauthorized' });
  }

  const sql = 'SELECT first_name, last_name, phone, specialization, schedule FROM Doctors WHERE id = ?';
  
  con.query(sql, [doctorId], (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Server error' });
      }

      if (results.length > 0) {
          // Send back doctor details
          res.status(200).json(results[0]);
      } else {
          res.status(404).json({ message: 'Doctor not found' });
      }
  });
});

// Doctor account deletion (DELETE)
app.delete('/doctor/delete', (req, res) => {
  const doctorId = req.session.doctorId;  // Get doctor ID from session

  if (!doctorId) {
      return res.status(401).json({ message: 'Unauthorized' });
  }

  const sql = 'DELETE FROM Doctors WHERE id = ?';

  con.query(sql, [doctorId], (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Server error' });
      }

      if (results.affectedRows > 0) {
          // Destroy session after deletion
          req.session.destroy((err) => {
              if (err) {
                  return res.status(500).json({ message: 'Failed to log out after deletion' });
              }
              res.status(200).json({ message: 'Account deleted successfully' });
          });
      } else {
          res.status(404).json({ message: 'Doctor not found' });
      }
  });
});

app.put('/api/doctors/:id', (req, res) => {
  console.log( req.params.id, req.body)
  const doctorId = req.params.id;
  const { first_name, last_name, specialization, phone, schedule } = req.body;

  // Prepare the SQL update statement
  const updateQuery = `
      UPDATE Doctors SET 
          first_name = ?, 
          last_name = ?, 
          specialization = ?,  
          phone = ?, 
          schedule = ? 
      WHERE id = ?
  `;

  con.query(updateQuery, [first_name, last_name, specialization, phone, schedule, doctorId], (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Server error', error: err });
      }
      if (results.affectedRows === 0) {
          return res.status(404).json({ message: 'Doctor not found' });
      }
      res.json({ message: 'Doctor details updated successfully' });
  });
});

// Fetch appointments for a specific doctor
app.get('/api/appointments/:doctorId', (req, res) => {
  const doctorId = req.params.doctorId;

  // SQL query to get appointments for the logged-in doctor
  const query = `
      SELECT A.id, A.patient_id, A.appointment_date, A.appointment_time, A.status, P.first_name AS patient_first_name, P.last_name AS patient_last_name
      FROM Appointments A
      JOIN Patients P ON A.patient_id = P.id
      WHERE A.doctor_id = ?
      ORDER BY A.appointment_date, A.appointment_time
  `;

  con.query(query, [doctorId], (err, results) => {
      if (err) {
          console.error('Database Error:', err);
          return res.status(500).json({ message: 'Internal server error', error: err.message });
      }
      res.json(results);
  });
});

app.post("/admin/signup", async (req, res) => {
    const { username, role, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, salt);

    // SQL query to insert admin details into the database
    const query = "INSERT INTO admin (username, role, password_hash) VALUES (?, ?, ?)";
    const values = [username, role, hashedPassword];

    // Execute the query
    con.query(query, values, (err, result) => {
        if (err) {
            console.error("Error inserting admin data:", err);
            return res.status(500).json({ message: err, err });
        }
        console.log("Admin added:", result);
        res.status(201).json({ message: "Admin signed up successfully", adminId: result.insertId });
    });
});

app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    // Query the database to check if the admin exists
    const query = "SELECT * FROM admin WHERE username = ?";
    con.query(query, [username], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Server error" });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: "Invalid username or password" });
        }

        const admin = results[0];
        
        // Compare the password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid username or password" });
        }

        // Send the admin details (username and role) back to the client
        res.status(200).json({
            message: "Login successful",
            username: admin.username,
            role: admin.role
        });
    });
});

app.delete("/admin/:username", (req, res) => {
    const { username } = req.params;

    const query = "DELETE FROM admin WHERE username = ?";
    con.query(query, [username], (err, result) => {
        if (err) {
            console.error("Error deleting admin:", err);
            return res.status(500).json({ message: "Server error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Admin not found" });
        }

        res.status(200).json({ message: "Admin account deleted successfully" });
    });
});

// Update admin details
app.put("/admin/:username", (req, res) => {
    const { username } = req.params;
    const { role } = req.body; // Get the updated role from the request body

    const query = "UPDATE admin SET role = ? WHERE username = ?";
    con.query(query, [role, username], (err, result) => {
        if (err) {
            console.error("Error updating admin:", err);
            return res.status(500).json({ message: "Server error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Admin not found" });
        }

        res.status(200).json({ message: "Admin updated successfully" });
    });
});

app.delete("/doctors/:id", (req, res) => {
    const doctorId = req.params.id;

    const query = "DELETE FROM Doctors WHERE id = ?";
    con.query(query, [doctorId], (err, result) => {
        if (err) {
            console.error("Error deleting doctor:", err);
            return res.status(500).json({ message: "Server error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        res.status(200).json({ message: "Doctor deleted successfully" });
    });
});
// Route to fetch all appointments
app.get('/admin/appointments', (req, res) => {
    const query = 'SELECT * FROM Appointments';
    
    con.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching appointments:', err);
            res.status(500).json({ error: 'Failed to fetch appointments' });
        } else {
            res.json(result); // Send the fetched appointments to the frontend
        }
    });
});

// Route to update the status of an appointment
app.put('/admin/appointments/:id', (req, res) => {
    const appointmentId = req.params.id;
    const { status } = req.body; // Get the new status from the request body
    
    // Validate the status value (should be one of 'scheduled', 'completed', 'canceled')
    if (!['scheduled', 'completed', 'canceled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    const query = 'UPDATE Appointments SET status = ? WHERE id = ?';
    
    con.query(query, [status, appointmentId], (err, result) => {
        if (err) {
            console.error('Error updating appointment status:', err);
            res.status(500).json({ error: 'Failed to update appointment status' });
        } else if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Appointment not found' });
        } else {
            res.json({ message: 'Appointment status updated successfully' });
        }
    });
});

app.listen(port,()=>{
    console.log(`server is running on http://localhost:${port}`)
})

