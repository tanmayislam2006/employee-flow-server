const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
app.use(cors());
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
    // get signle user information
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = {
        email,
      };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    // register the user data
    app.post("/user", async (req, res) => {
      const { profileInfo } = req.body;
      const result = await userCollection.insertOne(profileInfo);
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
