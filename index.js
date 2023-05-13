// Import express and faker
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();
const cors = require("cors");
const { faker } = require("@faker-js/faker");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const parser = require("body-parser");

// Create an express app
const app = express();

app.use(cors());
// Use JSON middleware
app.use(express.json());

app.listen(8001, (err) => {
  if (err) {
    console.log(err);
  }
  console.log("Listening to port 8001");
});

const db = async () => {
  try {
    const pool = await mysql.createPool({
      connectionLimit: 10,
      host: "localhost",
      user: "root",
      password: "admin",
      database: "jobportal",
      port: 3306,
    });
    console.log("Database connected succesfully!");
    return pool;
  } catch (error) {
    console.log(error.message);
  }
};
let recruiters = [];
let jobseekers = [];
let jobs = [];

const getJobseekerByFirstName = async () => {
  try {
    const pool = await db();
    const [rows, fields] = await pool.query("SELECT * FROM jobseeker");

    return rows;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
// getJobseekerByFirstName("John")
//   .then((result) => console.log(result))
//   .catch((error) => console.log(error));

const insertRandomJobSeeker = async () => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const email = faker.internet.email();
  const password = faker.internet.password();

  try {
    const pool = await db();
    const result = await pool.query(
      "INSERT INTO jobseeker (firstName, lastName, email, password) VALUES (?, ?, ?, ?)",
      [firstName, lastName, email, password]
    );
    console.log(`Inserted job seeker with ID ${result.insertId}`);
  } catch (error) {
    console.log(error);
    throw error;
  }
};
// setInterval(() => {
//   insertRandomJobSeeker();
// }, 5000);

// pool.on("connection", () => {
//   console.log("Connected to MySQL database");
// });
// Middleware to authenticate requests
const authenticate = (req, res, next) => {
  // Get the authorization header from the request
  const authHeader = req.headers.authorization;

  // If no authorization header is present, send an error response
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Extract the token from the authorization header
  const token = authHeader.split(" ")[1];

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
    // If verification fails, send an error response
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if the decoded token contains a recruiter ID
    if (!decodedToken.recruiterId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Find the recruiter with the given ID
    const recruiter = recruiters.find(
      (recruiter) => recruiter.id === decodedToken.recruiterId
    );

    // If not found, send an error response
    if (!recruiter) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach the recruiter object to the request object for use in the route handlers
    req.recruiter = recruiter;

    // Call the next middleware or route handler
    next();
  });
};

// Define some fake data

let applications = [];
let savedJobs = [];

// Generate some fake recruiters
for (let i = 0; i < 10; i++) {
  recruiters.push({
    id: faker.datatype.uuid(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    mobileNumber: faker.phone.number(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    address: faker.address.streetAddress(),
  });
}

// Generate some fake jobseekers
for (let i = 0; i < 10; i++) {
  jobseekers.push({
    id: faker.datatype.uuid(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    mobileNumber: faker.phone.number(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    address: faker.address.streetAddress(),
    qualification: faker.name.jobArea(),
    skillset: faker.random.words(3),
    experience: faker.datatype.number(10),
    summary: faker.lorem.sentence(),
    resume: faker.system.filePath(),
  });
}

// Generate some fake jobs
for (let i = 0; i < 20; i++) {
  jobs.push({
    id: faker.datatype.uuid(),
    jobTitle: faker.name.jobTitle(),
    jobDescription: faker.lorem.paragraph(),
    location: faker.address.city(),
    jobType: faker.helpers.arrayElement(["Full-time", "Part-time", "Contract"]),
    experience: faker.datatype.number(10),
    qualification: faker.name.jobArea(),
    salary: faker.finance.amount(10000, 100000, 2),
    skillset: faker.random.words(3),
    vacancy: faker.datatype.number(10),
    recruiter_id: recruiters[faker.datatype.number(recruiters.length - 1)].id,
  });
}

//get recruiters
app.get("/recruiters", (req, res) => {
  res.send(recruiters);
});

// get jobseekers
app.get("/jobseekers", (req, res) => {
  res.send(jobseekers);
});

app.post("/recruiter/signup", async (req, res) => {
  // Get the request body
  const { firstName, lastName, mobileNumber, email, password } = req.body;

  // Validate the input
  if (
    !firstName ||
    !lastName ||
    !mobileNumber ||
    !email ||
    !password ||
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof mobileNumber !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({ message: "Invalid input" });
  }

  // Check if the email already exists
  const existingRecruiter = recruiters.find(
    (recruiter) => recruiter.email === email
  );
  if (existingRecruiter) {
    return res.status(409).json({ message: "Email already exists" });
  }

  // Hash the password using bcrypt
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new recruiter object
  const newRecruiter = {
    id: faker.datatype.uuid(),
    firstName,
    lastName,
    mobileNumber,
    email,
    password: hashedPassword,
  };

  // Add the new recruiter to the array
  recruiters.push(newRecruiter);

  // Generate a JWT token for the new recruiter
  const token = jwt.sign(
    { id: newRecruiter.id, email: newRecruiter.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Send a success response with the new recruiter data and JWT token
  res
    .status(201)
    .json({ message: "Recruiter created", data: newRecruiter, token });
});
app.post("/recruiter/signin", async (req, res) => {
  // Get the request body
  const { email, password } = req.body;

  // Validate the input
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({ message: "Invalid input" });
  }

  // Find the recruiter with the given email
  const recruiter = recruiters.find((recruiter) => recruiter.email === email);

  // If not found, send an error response
  if (!recruiter) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Check if the password is correct using bcrypt
  const isPasswordCorrect = await bcrypt.compare(password, recruiter.password);
  if (!isPasswordCorrect) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Generate a JWT token for the recruiter
  const token = jwt.sign(
    { id: recruiter.id, email: recruiter.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // If found and password is correct, send a success response with the recruiter data and JWT token
  res
    .status(200)
    .json({ message: "Recruiter signed in", data: recruiter, token });
});

// Define the recruiter signup endpoint
app.post("/jobseeker/signup", async (req, res) => {
  // Get the request body
  const { firstName, lastName, mobileNumber, email, password } = req.body;

  // Validate the input
  if (
    !firstName ||
    !lastName ||
    !mobileNumber ||
    !email ||
    !password ||
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof mobileNumber !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({ message: "Invalid input" });
  }

  // Check if the email already exists
  const existingJobseeker = jobseekers.find(
    (jobseeker) => jobseeker.email === email
  );
  if (existingJobseeker) {
    return res.status(409).json({ message: "Email already exists" });
  }

  // Hash the password using bcrypt
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new recruiter object
  const newJobseeker = {
    id: faker.datatype.uuid(),
    firstName,
    lastName,
    mobileNumber,
    email,
    password: hashedPassword,
  };

  // Add the new recruiter to the array
  jobseekers.push(newJobseeker);

  // Generate a JWT token for the new recruiter
  const token = jwt.sign(
    { id: newJobseeker.id, email: newJobseeker.email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  // Send a success response with the new recruiter data and JWT token
  res
    .status(201)
    .json({ message: "Jobseeker created", data: newJobseeker, token });
});

// Define the recruiter signin endpoint
app.post("/jobseeker/signin", async (req, res) => {
  // Get the request body
  const { email, password } = req.body;

  // Validate the input
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({ message: "Invalid input" });
  }

  // Find the recruiter with the given email
  const jobseeker = jobseekers.find((jobseeker) => jobseeker.email === email);

  // If not found, send an error response
  if (!jobseeker) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Check if the password is correct using bcrypt
  const isPasswordCorrect = await bcrypt.compare(password, jobseeker.password);
  if (!isPasswordCorrect) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Generate a JWT token for the recruiter
  const token = jwt.sign(
    { id: jobseeker.id, email: jobseeker.email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  // If found and password is correct, send a success response with the recruiter data and JWT token
  res
    .status(200)
    .json({ message: "Jobseeker signed in", data: jobseeker, token });
});

// Define the recruiter profile update endpoint

app.put("/recruiter/updateprofile/:id", authenticate, (req, res) => {
  // Get the request parameters
  const { id } = req.params;

  // Get the request body
  const { firstName, lastName, mobileNumber, email, password, address } =
    req.body;

  // Validate the input
  if (
    !firstName ||
    !lastName ||
    !mobileNumber ||
    !email ||
    !password ||
    !address ||
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof mobileNumber !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof address !== "string"
  ) {
    return res.status(400).json({ message: "Invalid input" });
  }

  // Find the recruiter with the given id
  const recruiter = recruiters.find((recruiter) => recruiter.id === id);

  // If not found, send an error response
  if (!recruiter) {
    return res.status(404).json({ message: "Recruiter not found" });
  }

  // Update the recruiter data with the new values
  recruiter.firstName = firstName;
  recruiter.lastName = lastName;
  recruiter.mobileNumber = mobileNumber;
  recruiter.email = email;
  recruiter.password = password;
  recruiter.address = address;

  // Send a success response with the updated recruiter data
  res.status(200).json({ message: "Recruiter updated", data: recruiter });
});

// Define the recruiter profile endpoint
app.get("/recruiter/profile/:id", authenticate, (req, res) => {
  // Get the request parameters
  const { id } = req.params;

  // Find the recruiter with the given id
  const recruiter = recruiters.find((recruiter) => recruiter.id === id);

  // If not found, send an error response
  if (!recruiter) {
    return res.status(404).json({ message: "Recruiter not found" });
  }

  // Send a success response with the recruiter data
  res.status(200).json({ message: "Recruiter found", data: recruiter });
});

// Define the job post endpoint
app.post("/recruiter/jobpost", authenticate, (req, res) => {
  // Get the request body
  const {
    jobTitle,
    jobDescription,
    location,
    jobType,
    experience,
    qualification,
    salary,
    skillset,
    vacancy,
    recruiter_id,
  } = req.body;

  // Validate the input
  if (
    !jobTitle ||
    !jobDescription ||
    !location ||
    !jobType ||
    !experience ||
    !qualification ||
    !salary ||
    !skillset ||
    !vacancy ||
    !recruiter_id ||
    typeof jobTitle !== "string" ||
    typeof jobDescription !== "string" ||
    typeof location !== "string" ||
    typeof jobType !== "string" ||
    typeof experience !== "number" ||
    typeof qualification !== "string" ||
    typeof salary !== "number" ||
    typeof skillset !== "string" ||
    typeof vacancy !== "number" ||
    typeof recruiter_id !== "string"
  ) {
    return res.status(400).json({ message: "Invalid input" });
  }

  // Check if the recruiter id exists
  const recruiter = recruiters.find(
    (recruiter) => recruiter.id === recruiter_id
  );
  if (!recruiter) {
    return res.status(404).json({ message: "Recruiter not found" });
  }

  // Create a new job object
  const newJob = {
    id: faker.datatype.uuid(),
    jobTitle,
    jobDescription,
    location,
    jobType,
    experience,
    qualification,
    salary,
    skillset,
    vacancy,
    recruiter_id,
  };

  // Add the new job to the array
  jobs.push(newJob);

  // Send a success response with the new job data
  res.status(201).json({ message: "Job posted", data: newJob });
});

// Define the view all jobs endpoint
app.get("/recruiter/alljobs", authenticate, (req, res) => {
  // Send a success response with all the jobs data
  res.status(200).json({ message: "All jobs", data: jobs });
});

// Define the update job endpoint
app.put("/recruiter/updatejobpost/:id", (req, res) => {});
