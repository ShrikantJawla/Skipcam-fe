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
    { urls: "stun:stun.cloudflare.com:3478" },
    // Optional TURN via env (static openrelay creds are dead)
    ...(process.env.NEXT_PUBLIC_TURN_URLS
      ? [
          {
            urls: process.env.NEXT_PUBLIC_TURN_URLS.split(",").map((u) =>
              u.trim(),
            ),
            username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
          },
        ]
      : []),
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

async function playMedia(
  el: HTMLMediaElement | null | undefined,
  label: string,
) {
  if (!el) return;
  try {
    await el.play();
  } catch (err) {
    console.warn(`[Skipcam] ${label} play() failed:`, err);
  }
}

export function useWebRTC() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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
  const countedConnectionRef = useRef(false);
  const onConnectedRef = useRef<(() => void) | null>(null);
  const makingOfferRef = useRef(false);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const stopRemoteAudio = useCallback(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.srcObject = null;
    remoteAudioRef.current = null;
  }, []);

  const attachRemoteTrack = useCallback(
    (track: MediaStreamTrack, inboundStream?: MediaStream) => {
      if (inboundStream) {
        remoteStreamRef.current = inboundStream;
      } else {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        const hasTrack = remoteStreamRef.current
          .getTracks()
          .some((t) => t.id === track.id);
        if (!hasTrack) {
          remoteStreamRef.current.addTrack(track);
        }
      }

      const stream = remoteStreamRef.current;
      if (!stream) return;

      const video = remoteVideoRef.current;
      if (video) {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }
        // Keep video element muted — unmuted autoplay is blocked on mobile (blank).
        video.muted = true;
        video.playsInline = true;
        void playMedia(video, "remote video");
      }

      // Remote audio on a separate element so video can stay muted for autoplay
      if (stream.getAudioTracks().length > 0) {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        const audio = remoteAudioRef.current;
        if (audio.srcObject !== stream) {
          audio.srcObject = stream;
        }
        audio.muted = false;
        void playMedia(audio, "remote audio");
      }

      setStatus("connected");
      if (!countedConnectionRef.current) {
        countedConnectionRef.current = true;
        setMatchFlash(true);
        onConnectedRef.current?.();
        window.setTimeout(() => setMatchFlash(false), 2200);
      }
    },
    [],
  );

  const cleanupPeerConnection = useCallback(() => {
    makingOfferRef.current = false;
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    remoteStreamRef.current = null;
    stopRemoteAudio();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [stopRemoteAudio]);

  const addLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn("[Skipcam] No local stream when adding tracks");
      return;
    }

    const existing = new Set(
      pc
        .getSenders()
        .map((s) => s.track?.id)
        .filter(Boolean),
    );

    for (const track of stream.getTracks()) {
      if (existing.has(track.id)) continue;
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
        console.log("[Skipcam] ontrack", event.track.kind, event.track.id);
        attachRemoteTrack(event.track, event.streams[0]);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[Skipcam] ice:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          setConnectionError(
            "Video link dropped. Tap Next to try another match.",
          );
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[Skipcam] pc:", pc.connectionState);
      };

      return pc;
    },
    [attachRemoteTrack, cleanupPeerConnection],
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
        addLocalTracks(pc);

        if (!initiator) return;

        makingOfferRef.current = true;
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit("offer", pc.localDescription);
        } catch (err) {
          console.error("Failed to create offer:", err);
          setConnectionError("Could not start video. Tap Next to retry.");
        } finally {
          makingOfferRef.current = false;
        }
      });

      socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
        const socketInstance = socketRef.current;
        if (!socketInstance) return;

        try {
          let pc = pcRef.current;
          if (!pc || pc.signalingState === "closed") {
            pc = createPeerConnection(socketInstance);
            addLocalTracks(pc);
          }

          // Ignore glare if we're currently making an offer
          if (makingOfferRef.current) return;

          await pc.setRemoteDescription(offer);
          addLocalTracks(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketInstance.emit("answer", pc.localDescription);
          await flushPendingCandidates(pc);
        } catch (err) {
          console.error("Failed to handle offer:", err);
          setConnectionError("Could not answer video. Tap Next to retry.");
        }
      });

      socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
        const pc = pcRef.current;
        if (!pc) return;

        try {
          if (pc.signalingState !== "have-local-offer") {
            console.warn(
              "[Skipcam] Unexpected answer in state",
              pc.signalingState,
            );
            return;
          }
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: "user" },
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
          void playMedia(localVideoRef.current, "local video");
        }
      } catch (err) {
        console.error("Failed to access camera/microphone:", err);
        setCameraReady(false);
        setConnectionError("Camera/microphone permission is required.");
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
    void playMedia(video, "local video");
  });

  // Keep remote video painted after UI swaps (placeholder off → on)
  useEffect(() => {
    if (status !== "connected") return;
    const stream = remoteStreamRef.current;
    const video = remoteVideoRef.current;
    if (!stream || !video) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.muted = true;
    void playMedia(video, "remote video refresh");
  }, [status]);

  const startMatching = useCallback(() => {
    setConnectionError(null);
    setStatus("waiting");

    if (!socketRef.current) {
      const socket = io(getSignalingUrl(), {
        transports: ["polling", "websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 8,
        timeout: 20000,
      });
      socketRef.current = socket;
      bindSocketEvents(socket);

      socket.on("connect", () => {
        setConnectionError(null);
        socket.emit("find-match");
      });

      socket.on("connect_error", (err) => {
        console.error("Signaling connect error:", err.message);
        setConnectionError(
          "Could not reach the matchmaking server. Retrying…",
        );
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
    setConnectionError(null);
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
