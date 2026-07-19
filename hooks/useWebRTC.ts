"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

function getSignalingUrl() {
  if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
    return process.env.NEXT_PUBLIC_SIGNALING_URL;
  }
  if (
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return "https://skipcam-be.onrender.com";
  }
  return "http://localhost:5000";
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Public free TURN relay — needed when peers are behind strict NATs
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export type MatchStatus = "idle" | "waiting" | "connecting" | "connected";

export type ChatMessage = {
  id: string;
  text: string;
  from: "me" | "stranger";
  at: number;
};

function makeMessage(text: string, from: ChatMessage["from"]): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    from,
    at: Date.now(),
  };
}

export function useWebRTC() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<MatchStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchFlash, setMatchFlash] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [incomingReaction, setIncomingReaction] = useState<{
    id: string;
    emoji: string;
  } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const countedConnectionRef = useRef(false);
  const onConnectedRef = useRef<(() => void) | null>(null);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const addLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream || pc.getSenders().some((s) => s.track)) return;
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
  }, []);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error("Failed to add ICE candidate:", err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (socket: Socket) => {
      cleanupPeerConnection();

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        const video = remoteVideoRef.current;
        if (video) {
          video.srcObject = stream;
          // Keep muted so mobile autoplay still shows frames
          video.muted = true;
          video.playsInline = true;
          void video.play().catch(() => {});
        }
        setStatus("connected");
        if (!countedConnectionRef.current) {
          countedConnectionRef.current = true;
          setMatchFlash(true);
          onConnectedRef.current?.();
          window.setTimeout(() => setMatchFlash(false), 2200);
        }
      };

      return pc;
    },
    [cleanupPeerConnection],
  );

  const bindSocketEvents = useCallback(
    (socket: Socket) => {
      socket.off("waiting");
      socket.off("matched");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("partner-left");
      socket.off("chat-message");
      socket.off("reaction");

      socket.on("waiting", () => {
        setStatus("waiting");
      });

      socket.on("matched", async ({ initiator }: { initiator: boolean }) => {
        clearChat();
        countedConnectionRef.current = false;
        setConnectionError(null);
        setStatus("connecting");
        const pc = createPeerConnection(socket);

        if (initiator) {
          addLocalTracks(pc);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", offer);
          } catch (err) {
            console.error("Failed to create offer:", err);
          }
        }
      });

      socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
        const socketInstance = socketRef.current;
        if (!socketInstance) return;

        const pc = pcRef.current ?? createPeerConnection(socketInstance);

        try {
          await pc.setRemoteDescription(offer);
          addLocalTracks(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketInstance.emit("answer", answer);
          await flushPendingCandidates(pc);
        } catch (err) {
          console.error("Failed to handle offer:", err);
        }
      });

      socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
        const pc = pcRef.current;
        if (!pc) return;

        try {
          await pc.setRemoteDescription(answer);
          await flushPendingCandidates(pc);
        } catch (err) {
          console.error("Failed to handle answer:", err);
        }
      });

      socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }

        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error("Failed to add ICE candidate:", err);
        }
      });

      socket.on("chat-message", (payload: { text?: string }) => {
        const text = payload?.text?.trim();
        if (!text) return;
        setMessages((current) => [...current, makeMessage(text, "stranger")]);
      });

      socket.on("reaction", (payload: { emoji?: string }) => {
        const emoji = payload?.emoji;
        if (!emoji) return;
        setIncomingReaction({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          emoji,
        });
      });

      socket.on("partner-left", () => {
        cleanupPeerConnection();
        clearChat();
        countedConnectionRef.current = false;
        setStatus("waiting");
        socket.emit("find-match");
      });
    },
    [
      addLocalTracks,
      cleanupPeerConnection,
      clearChat,
      createPeerConnection,
      flushPendingCandidates,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Aspect ratio only on mobile (portrait). Desktop uses the natural camera.
        const isMobile =
          typeof navigator !== "undefined" &&
          (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && window.innerWidth < 900));

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isMobile
            ? {
                facingMode: "user",
                aspectRatio: { ideal: 9 / 16 },
              }
            : { facingMode: "user" },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setCameraReady(true);
        setMicOn(true);
        setCameraOn(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access camera/microphone:", err);
        setCameraReady(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanupPeerConnection();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [cleanupPeerConnection]);

  useEffect(() => {
    const video = localVideoRef.current;
    const stream = localStreamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    void video.play().catch(() => {});
  });

  const startMatching = useCallback(() => {
    setConnectionError(null);
    setStatus("waiting");

    if (!socketRef.current) {
      const socket = io(getSignalingUrl(), {
        // Polling first is more reliable behind Render / Cloudflare
        transports: ["polling", "websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 8,
        timeout: 15000,
      });
      socketRef.current = socket;
      bindSocketEvents(socket);

      socket.on("connect", () => {
        setConnectionError(null);
        socket.emit("find-match");
      });

      socket.on("connect_error", (err) => {
        console.error("Signaling connect error:", err.message);
        setConnectionError("Could not reach the matchmaking server. Retrying…");
      });
    } else if (socketRef.current.connected) {
      socketRef.current.emit("find-match");
    } else {
      socketRef.current.connect();
      socketRef.current.once("connect", () => {
        socketRef.current?.emit("find-match");
      });
    }
  }, [bindSocketEvents]);

  const nextPartner = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    cleanupPeerConnection();
    clearChat();
    countedConnectionRef.current = false;
    setStatus("waiting");
    socket.emit("next");
  }, [cleanupPeerConnection, clearChat]);

  const sendMessage = useCallback((text: string) => {
    const socket = socketRef.current;
    const trimmed = text.trim();
    if (!socket || !trimmed) return;

    setMessages((current) => [...current, makeMessage(trimmed, "me")]);
    socket.emit("chat-message", trimmed);
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("reaction", emoji);
  }, []);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }, []);

  const reportPartner = useCallback((reason = "inappropriate") => {
    const socket = socketRef.current;
    if (!socket) return false;
    socket.emit("report", { reason });
    return true;
  }, []);

  const setOnConnected = useCallback((handler: (() => void) | null) => {
    onConnectedRef.current = handler;
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    status,
    messages,
    matchFlash,
    incomingReaction,
    micOn,
    cameraOn,
    cameraReady,
    connectionError,
    startMatching,
    nextPartner,
    sendMessage,
    sendReaction,
    toggleMic,
    toggleCamera,
    reportPartner,
    setOnConnected,
  };
}
