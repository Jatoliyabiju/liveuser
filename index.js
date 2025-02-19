const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect("mongodb+srv://jatoliyabrijesh2000:Jatoliya11@cluster0.ozftv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Static Files Serve
app.use(express.static(path.join(__dirname, "public")));

// Home Page Route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Display Page Route
app.get("/display", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "display.html"));
});

// Mongoose Schema
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    mobile: { type: String, match: /^[0-9]{10}$/, required: true },
    email: { type: String, match: /\S+@\S+\.\S+/, required: true },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true },
    },
    loginId: { type: String, minlength: 8, maxlength: 12, required: true },
    password: { type: String, minlength: 6, required: true },
    creationTime: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now },
    socketId: { type: String, default: null }
});

const User = mongoose.model("User", userSchema);

// API to Save User Data & Join Room
app.post("/api/users", async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).send(user);

        io.emit("newUser", user); // Notify clients about new user
    } catch (error) {
        res.status(400).send(error);
    }
});

// API to Get Live Users
app.get("/api/live-users", async (req, res) => {
    try {
        const users = await User.find(
            { socketId: { $ne: null } },
            { firstName: 1, email: 1, socketId: 1, _id: 0 } // ✅ Only return required fields
        );
        res.send(users);
    } catch (error) {
        res.status(500).send({ error: "Failed to fetch users" });
    }
});



// 🔥 **Socket.io Handling**
io.on("connection", (socket) => {
    console.log("✅ New user connected:", socket.id);

    // **User Joins Room & socketId Update**
    socket.on("joinRoom", async (userEmail) => {
        socket.join("live_users");
        console.log(`ℹ️ ${userEmail} joined 'live_users' with socket ID: ${socket.id}`);

        // **Database me socketId update karein**
        const updatedUser = await User.findOneAndUpdate(
            { email: userEmail },
            { socketId: socket.id },
            { new: true }
        );

        if (updatedUser) {
            console.log("✅ Updated User with Socket ID:", updatedUser);
        } else {
            console.log("❌ User not found:", userEmail);
        }

        // **Live Users List Update & Emit**
        const liveUsers = await User.find({ socketId: { $ne: null } });
        io.to("live_users").emit("updateUserList", liveUsers);
    });

    // **User Disconnect Handling**
    socket.on("disconnect", async () => {
        console.log("❌ User disconnected:", socket.id);

        await User.findOneAndUpdate(
            { socketId: socket.id },
            { socketId: null }
        );

        // **Live Users List Update & Emit**
        const liveUsers = await User.find({ socketId: { $ne: null } });
        io.to("live_users").emit("updateUserList", liveUsers);
    });
});



const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
