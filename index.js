const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cookieParser = require("cookie-parser");
app.use(
  cors({
    origin: ["http://localhost:5173", "https://employee-flow-app.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xozk3nx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
app.get("/", (req, res) => {
  res.send("Employee Flow Server Is Running");
});
async function run() {
  try {
    const employeeFLow = client.db("Employee-Flow");
    const userCollection = employeeFLow.collection("Users");
    const employeeWorkSheets = employeeFLow.collection("Work-Sheets");
    const payRolls = employeeFLow.collection("Pay-Rolls");
    const transactions = employeeFLow.collection("Transactions");
    // get signle user information
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        email,
      };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    // get specific user work sheets
    app.get("/myWorkSheet/:email", async (req, res) => {
      const email = req.params.email;
      const query = { employee_email: email };
      const result = await employeeWorkSheets
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    // get all user(employee) work sheets for HR
    app.get("/workSheets", async (req, res) => {
      const { employee, search, month, year } = req.query;

      /**
       * Build $match stage dynamically based on provided query parameters
       */
      const matchStage = {};

      // Filter by employee name (exact match)
      if (employee) {
        matchStage.employee_name = employee;
      }

      // Filter by search term (partial match, case-insensitive) on name or email
      if (search) {
        matchStage.$or = [
          { employee_name: { $regex: search, $options: "i" } },
          { employee_email: { $regex: search, $options: "i" } },
        ];
      }

      // Later we'll add month and year filtering after projecting them

      try {
        const pipeline = [
          /**
           * Stage 1: Add month and year fields
           * - Converts 'date' string to Date
           * - Extracts month and year
           */
          {
            $addFields: {
              parsedDate: { $toDate: "$date" },
            },
          },
          {
            $addFields: {
              month: { $month: "$parsedDate" },
              year: { $year: "$parsedDate" },
            },
          },

          /**
           * Stage 2: Match stage
           * - Includes employee, search filters from query
           * - Adds month and year if provided
           */
          {
            $match: {
              ...matchStage,
              ...(month ? { month: parseInt(month) } : {}),
              ...(year ? { year: parseInt(year) } : {}),
            },
          },

          /**
           * Stage 3: Optionally remove added fields
           * (you can keep them if you want)
           */
          {
            $project: {
              parsedDate: 0,
              month: 0,
              year: 0,
            },
          },
        ];

        // Run aggregation pipeline
        const results = await employeeWorkSheets.aggregate(pipeline).toArray();

        res.send(results);
      } catch (error) {
        console.error("Error in /workSheets:", error);
        res.status(500).send({ message: "Server error", error });
      }
    });

    // get all user for Hr
    app.get("/users", async (req, res) => {
      const query = {};
      const { isVerified } = req.query;
      if (isVerified) {
        query.isVerified = isVerified === "true";
      }
      const users = await userCollection.find(query).toArray();
      res.send(users);
    });
    // get all pay roll for admin and hr
    app.get("/payRolls", async (req, res) => {
      const query = {};
      const { status,employeeEmail } = req.query;
      if (status) {
        query.status = status;
      }
      if (employeeEmail) {
        query.employeeEmail = employeeEmail;
      }
      const result = await payRolls.find(query).sort({ payrequest_at: -1 }).toArray();
      res.send(result);
    });
    // get specifif id pay roll details for admon
    app.get("/payRoll/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await payRolls.findOne(query);
      res.send(result);
    });
    // get al payment transactions
    app.get("/transactions", async (req, res) => {
      const result = await transactions.find().toArray();
      res.send(result);
    });
    // get single user specific trasaction history this api is use for hr and employee
    app.get("/transactions/:email", async (req, res) => {
      const email = req.params.email;
      const query = { employeeEmail: email };
      const result = await transactions.find(query).toArray();
      res.send(result);
    });
    // register the user data
    app.post("/register", async (req, res) => {
      try {
        const { profileInfo } = req.body;
        const email = profileInfo?.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        // 1️⃣ Check if user already exists
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
          return res.status(200).send({ message: "User already exists" });
        }

        // 2️⃣ Insert new user
        const result = await userCollection.insertOne(profileInfo);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });
    // register user work sheets
    app.post("/workSheet", async (req, res) => {
      const sheetData = req.body;
      const result = await employeeWorkSheets.insertOne(sheetData);
      res.send(result);
    });
    // register the requested pay roll for employee by the user
    app.post("/payRoll", async (req, res) => {
      const payRollData = req.body;
      const result = await payRolls.insertOne(payRollData);
      res.send(result);
    });
    // create a payment api
    app.post("/create-payment-intent", async (req, res) => {
      const { payRollId, amount } = req.body;
      const payRoll = await payRolls.findOne({ _id: new ObjectId(payRollId) });
      if (!payRoll) {
        return res.status(404).send({ message: "PayRoll not found" });
      }
      if (Number(payRoll.salary) === Number(amount)) {
        const salary = Number(payRoll.salary) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: salary, // amount in cents or paisa
          currency: "usd", // use "usd" or "bdt" if available
          payment_method_types: ["card"],
        });
        // Send clientSecret to frontend
        res.send({ clientSecret: paymentIntent.client_secret });
      } else {
        return res.status(400).send({ message: "Salary amount mismatch" });
      }
    });
    app.post("/transaction", async (req, res) => {
      const transactionData = req.body;
      const result = await transactions.insertOne(transactionData);
      res.send(result);
    });
    // update the entires informatrion
    app.patch("/workSheet/:id", async (req, res) => {
      const id = req.params.id;
      const update = req.body;
      const result = await employeeWorkSheets.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );
      res.send(result);
    });
    // update the user verify status by HR
    app.patch("/user/:id/verify", async (req, res) => {
      const id = req.params.id;
      const { isVerified } = req.body;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isVerified } }
      );
      res.send(result);
    });
    // PATCH user by ID (update fields like role, salary, designation)
    app.patch("/user/:id", async (req, res) => {
      const id = req.params.id;
      const updatedFields = req.body;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedFields }
      );
      res.send(result);
    });
    // after payment success update the pay roll status
    app.patch("/payRoll/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const result = await payRolls.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send(result);
    });

    // update the last log int information
    app.patch("/login", async (req, res) => {
      const { email, lastSignInTime } = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          lastSignInTime: lastSignInTime,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //  delete a single entry form my work sheet
    app.delete("/myWorkSheet/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await employeeWorkSheets.deleteOne(query);
      res.send(result);
    });
    // delete or payroll by id a user by Admin
    app.delete("/payRoll/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await payRolls.deleteOne(query);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
app.listen(port, () => {
  const time = new Date().toLocaleTimeString();
  console.log(`Server is running on ${time} port http://localhost:${port}`);
});
