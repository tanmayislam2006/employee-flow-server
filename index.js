const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
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
