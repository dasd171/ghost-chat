const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Ghost Signal Server OK");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const users = new Map();

io.on("connection", (socket) => {
  console.log("connected");

  socket.on("register", (id) => {
    users.set(id, socket.id);
  });

  socket.on("call-user", ({ to, from, offer }) => {
    const sid = users.get(to);
    if (sid) {
      io.to(sid).emit("incoming-call", {
        from,
        offer,
      });
    }
  });

  socket.on("answer-call", ({ to, answer }) => {
    const sid = users.get(to);
    if (sid) {
      io.to(sid).emit("call-answered", answer);
    }
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const sid = users.get(to);
    if (sid) {
      io.to(sid).emit("ice-candidate", candidate);
    }
  });

  socket.on("disconnect", () => {
    for (const [id, sid] of users) {
      if (sid === socket.id) {
        users.delete(id);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log("running on " + PORT);
});
