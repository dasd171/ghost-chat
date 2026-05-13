"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SIGNAL_URL = "https://ghost-chat-signal.onrender.com";

export default function Home() {
  const [myId, setMyId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    const id = crypto.randomUUID().slice(0, 8);
    setMyId(id);

    const socket = io(SIGNAL_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("register", id);
    });

    socket.on("incoming-call", async ({ from, offer }) => {
      createPeer(from);

      if (!peerRef.current) return;

      await peerRef.current.setRemoteDescription(offer);

      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      socket.emit("answer-call", {
        to: from,
        answer,
      });
    });

    socket.on("call-answered", async (answer) => {
      if (!peerRef.current) return;
      await peerRef.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async (candidate) => {
      if (!peerRef.current) return;
      await peerRef.current.addIceCandidate(candidate);
    });

    return () => {
      socket.disconnect();
      peerRef.current?.close();
    };
  }, []);

  function createPeer(remoteId: string) {
    const peer = new RTCPeerConnection({
     iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
]
    });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit("ice-candidate", {
          to: remoteId,
          candidate: e.candidate,
        });
      }
    };

    peer.ondatachannel = (event) => {
      channelRef.current = event.channel;

      event.channel.onopen = () => {
        setChat((c) => [...c, "✅ 连接成功"]);
      };

      event.channel.onmessage = (e) => {
        setChat((c) => [...c, "对方: " + e.data]);
      };
    };

    peerRef.current = peer;
  }

  async function connectToUser() {
    createPeer(targetId);

    if (!peerRef.current) return;

    const channel =
      peerRef.current.createDataChannel("chat");

    channelRef.current = channel;

    channel.onopen = () => {
      setChat((c) => [...c, "✅ 连接成功"]);
    };

    channel.onmessage = (e) => {
      setChat((c) => [...c, "对方: " + e.data]);
    };

    const offer = await peerRef.current.createOffer();

    await peerRef.current.setLocalDescription(offer);

    socketRef.current?.emit("call-user", {
      to: targetId,
      from: myId,
      offer,
    });
  }

  function sendMessage() {
    if (!message) return;

    if (
      !channelRef.current ||
      channelRef.current.readyState !== "open"
    ) {
      setChat((c) => [
        ...c,
        "⚠️ 还没连接成功，不能发送",
      ]);
      return;
    }

    channelRef.current.send(message);

    setChat((c) => [...c, "我: " + message]);
    setMessage("");
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">
        Ghost Chat
      </h1>

      <div>
        我的临时 ID:
        <span className="font-mono ml-2">
          {myId}
        </span>
      </div>

      <input
        className="border p-2 w-full"
        placeholder="输入对方 ID"
        value={targetId}
        onChange={(e) =>
          setTargetId(e.target.value)
        }
      />

      <button
        onClick={connectToUser}
        className="bg-black text-white px-4 py-2 rounded"
      >
        发起连接
      </button>

      <div className="border h-64 p-2 overflow-auto">
        {chat.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>

      <input
        className="border p-2 w-full"
        placeholder="输入消息"
        value={message}
        onChange={(e) =>
          setMessage(e.target.value)
        }
      />

      <button
        onClick={sendMessage}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        发送
      </button>
    </main>
  );
}
