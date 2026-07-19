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

function getVideoConstraints(): MediaTrackConstraints {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const mobile = Math.min(w, h) < 768;

  if (mobile && h >= w) {
    return {
      facingMode: "user",
      aspectRatio: { ideal: 9 / 16 },
      width: { ideal: 720 },
      height: { ideal: 1280 },
    };
  }

  return {
    facingMode: "user",
    aspectRatio: { ideal: 16 / 9 },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const countedConnectionRef = useRef(false);
  const onConnectedRef = useRef<(() => void) | null>(null);

  const clearChat = useCallback(() => setMessages([]), []);

  const showRemote = useCallback((stream: MediaStream) => {
    remoteStreamRef.current = stream;
    const video = remoteVideoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true; // required for autoplay on phones
    video.playsInline = true;
    void video.play().catch(() => {});
  }, []);

  const cleanupPc = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const addTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const existing = new Set(
      pc.getSenders().map((s) => s.track?.id).filter(Boolean),
    );
    for (const track of stream.getTracks()) {
      if (!existing.has(track.id)) pc.addTrack(track, stream);
    }
  }, []);

  const flushIce = useCallback(async (pc: RTCPeerConnection) => {
    const list = pendingCandidatesRef.current.splice(0);
    for (const c of list) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const makePc = useCallback(
    (socket: Socket) => {
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("ice-candidate", e.candidate.toJSON());
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        showRemote(stream);
        setStatus("connected");
        setConnectionError(null);
        if (!countedConnectionRef.current) {
          countedConnectionRef.current = true;
          setMatchFlash(true);
          onConnectedRef.current?.();
          window.setTimeout(() => setMatchFlash(false), 2200);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          setConnectionError(
            "Video link failed. Use the same Wi‑Fi on both devices, then tap Next.",
          );
        }
      };

      return pc;
    },
    [showRemote],
  );

  const answerOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, socket: Socket) => {
      let pc = pcRef.current;
      if (!pc) pc = makePc(socket);
      addTracks(pc);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", {
        type: answer.type,
        sdp: answer.sdp,
      });
      await flushIce(pc);
    },
    [addTracks, flushIce, makePc],
  );

  const bindSocketEvents = useCallback(
    (socket: Socket) => {
      socket.removeAllListeners("waiting");
      socket.removeAllListeners("matched");
      socket.removeAllListeners("offer");
      socket.removeAllListeners("answer");
      socket.removeAllListeners("ice-candidate");
      socket.removeAllListeners("partner-left");
      socket.removeAllListeners("chat-message");
      socket.removeAllListeners("reaction");

      socket.on("waiting", () => setStatus("waiting"));

      socket.on("matched", async ({ initiator }: { initiator: boolean }) => {
        clearChat();
        countedConnectionRef.current = false;
        setConnectionError(null);
        setStatus("connecting");

        const earlyOffer = pendingOfferRef.current;
        cleanupPc();
        pendingOfferRef.current = earlyOffer;

        const pc = makePc(socket);
        addTracks(pc);

        if (initiator) {
          pendingOfferRef.current = null;
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", { type: offer.type, sdp: offer.sdp });
          } catch (err) {
            console.error(err);
            setConnectionError("Could not start call. Tap Next.");
          }
          return;
        }

        if (earlyOffer?.sdp) {
          pendingOfferRef.current = null;
          try {
            await answerOffer(earlyOffer, socket);
          } catch (err) {
            console.error(err);
            setConnectionError("Could not join call. Tap Next.");
          }
        }
      });

      socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
        if (!offer?.sdp) return;
        // Offer can arrive before "matched"
        if (!pcRef.current) {
          pendingOfferRef.current = offer;
          return;
        }
        try {
          await answerOffer(offer, socket);
        } catch (err) {
          console.error(err);
        }
      });

      socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
        const pc = pcRef.current;
        if (!pc || !answer?.sdp) return;
        try {
          await pc.setRemoteDescription(answer);
          await flushIce(pc);
        } catch (err) {
          console.error(err);
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
        } catch {
          /* ignore */
        }
      });

      socket.on("chat-message", (payload: { text?: string }) => {
        const text = payload?.text?.trim();
        if (!text) return;
        setMessages((m) => [...m, makeMessage(text, "stranger")]);
      });

      socket.on("reaction", (payload: { emoji?: string }) => {
        if (!payload?.emoji) return;
        setIncomingReaction({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          emoji: payload.emoji,
        });
      });

      socket.on("partner-left", () => {
        cleanupPc();
        clearChat();
        countedConnectionRef.current = false;
        setStatus("waiting");
        socket.emit("find-match");
      });
    },
    [addTracks, answerOffer, cleanupPc, clearChat, flushIce, makePc],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: getVideoConstraints(),
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setCameraReady(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          void localVideoRef.current.play().catch(() => {});
        }
      } catch {
        setCameraReady(false);
        setConnectionError("Allow camera & mic access.");
      }
    })();

    return () => {
      cancelled = true;
      cleanupPc();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [cleanupPc]);

  useEffect(() => {
    const v = localVideoRef.current;
    const s = localStreamRef.current;
    if (!v || !s) return;
    if (v.srcObject !== s) v.srcObject = s;
    void v.play().catch(() => {});
  });

  // Re-show remote after UI switches out of placeholder
  useEffect(() => {
    if (status === "connected" && remoteStreamRef.current) {
      showRemote(remoteStreamRef.current);
    }
  }, [status, showRemote]);

  const startMatching = useCallback(() => {
    if (!localStreamRef.current) {
      setConnectionError("Camera not ready.");
      return;
    }
    setConnectionError(null);
    setStatus("waiting");
    cleanupPc();
    pendingOfferRef.current = null;

    if (!socketRef.current) {
      const socket = io(getSignalingUrl(), {
        transports: ["polling", "websocket"],
        reconnection: true,
      });
      socketRef.current = socket;
      bindSocketEvents(socket);
      socket.on("connect", () => socket.emit("find-match"));
      socket.on("connect_error", () =>
        setConnectionError("Cannot reach server…"),
      );
    } else if (socketRef.current.connected) {
      socketRef.current.emit("find-match");
    } else {
      socketRef.current.connect();
      socketRef.current.once("connect", () =>
        socketRef.current?.emit("find-match"),
      );
    }
  }, [bindSocketEvents, cleanupPc]);

  const nextPartner = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    cleanupPc();
    pendingOfferRef.current = null;
    clearChat();
    countedConnectionRef.current = false;
    setConnectionError(null);
    setStatus("waiting");
    socket.emit("next");
  }, [cleanupPc, clearChat]);

  const sendMessage = useCallback((text: string) => {
    const socket = socketRef.current;
    const trimmed = text.trim();
    if (!socket || !trimmed) return;
    setMessages((m) => [...m, makeMessage(trimmed, "me")]);
    socket.emit("chat-message", trimmed);
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    socketRef.current?.emit("reaction", emoji);
  }, []);

  const toggleMic = useCallback(() => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMicOn(t.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCameraOn(t.enabled);
  }, []);

  const reportPartner = useCallback((reason = "inappropriate") => {
    if (!socketRef.current) return false;
    socketRef.current.emit("report", { reason });
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
