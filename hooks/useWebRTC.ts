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

function getVideoConstraintsForScreen(): MediaTrackConstraints {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobileScreen = Math.min(width, height) < 768;
  const isPortrait = height >= width;

  if (isMobileScreen && isPortrait) {
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

const FALLBACK_ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
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

function sdpPayload(desc: RTCSessionDescription | RTCSessionDescriptionInit) {
  return { type: desc.type, sdp: desc.sdp };
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
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const iceConfigRef = useRef<RTCConfiguration>(FALLBACK_ICE);
  const countedConnectionRef = useRef(false);
  const onConnectedRef = useRef<(() => void) | null>(null);
  const isInitiatorRef = useRef(false);

  const clearChat = useCallback(() => setMessages([]), []);

  const bindRemoteMedia = useCallback((stream: MediaStream) => {
    remoteStreamRef.current = stream;

    const video = remoteVideoRef.current;
    if (video) {
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      void video.play().catch(() => {});
    }

    if (stream.getAudioTracks().length > 0) {
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      const audio = remoteAudioRef.current;
      audio.srcObject = stream;
      audio.muted = false;
      void audio.play().catch(() => {});
    }
  }, []);

  const cleanupPeerConnection = useCallback((opts?: { keepPendingOffer?: boolean }) => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    if (!opts?.keepPendingOffer) {
      pendingOfferRef.current = null;
    }
    remoteStreamRef.current = null;
    isInitiatorRef.current = false;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
  }, []);

  const addLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn("[Skipcam] local stream missing");
      return;
    }
    const have = new Set(
      pc.getSenders().map((s) => s.track?.id).filter(Boolean),
    );
    for (const track of stream.getTracks()) {
      if (!have.has(track.id)) pc.addTrack(track, stream);
    }
  }, []);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    }
  }, []);

  const loadIceConfig = useCallback(async () => {
    try {
      const res = await fetch(`${getSignalingUrl()}/ice`);
      if (!res.ok) return;
      const data = (await res.json()) as { iceServers?: RTCIceServer[] };
      if (data.iceServers?.length) {
        iceConfigRef.current = { iceServers: data.iceServers };
      }
    } catch {
      // keep fallback STUN
    }
  }, []);

  const createPeerConnection = useCallback(
    (socket: Socket) => {
      const pc = new RTCPeerConnection(iceConfigRef.current);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socket.emit("ice-candidate", event.candidate.toJSON());
      };

      pc.ontrack = (event) => {
        console.log("[Skipcam] remote track:", event.track.kind);
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        if (!event.streams[0] && remoteStreamRef.current) {
          remoteStreamRef.current.addTrack(event.track);
          bindRemoteMedia(remoteStreamRef.current);
        } else {
          bindRemoteMedia(stream);
        }

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
        console.log("[Skipcam] ICE:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") {
          setConnectionError(
            "Could not link cameras. Put both devices on the same Wi‑Fi, then tap Next.",
          );
          void pc.restartIce();
        }
      };

      return pc;
    },
    [bindRemoteMedia],
  );

  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, socket: Socket) => {
      const pc = pcRef.current ?? createPeerConnection(socket);
      addLocalTracks(pc);

      if (pc.signalingState !== "stable") {
        console.warn("[Skipcam] skip offer, state=", pc.signalingState);
        return;
      }

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", sdpPayload(pc.localDescription!));
      await flushPendingCandidates(pc);
    },
    [addLocalTracks, createPeerConnection, flushPendingCandidates],
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

      socket.on("waiting", () => setStatus("waiting"));

      socket.on("matched", async ({ initiator }: { initiator: boolean }) => {
        console.log("[Skipcam] matched, initiator=", initiator);
        clearChat();
        countedConnectionRef.current = false;
        setConnectionError(null);
        setStatus("connecting");

        // Preserve offer if it arrived before "matched"
        const earlyOffer = pendingOfferRef.current;
        cleanupPeerConnection({ keepPendingOffer: true });
        pendingOfferRef.current = earlyOffer;
        isInitiatorRef.current = initiator;

        await loadIceConfig();
        const pc = createPeerConnection(socket);
        addLocalTracks(pc);

        if (initiator) {
          pendingOfferRef.current = null;
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", sdpPayload(pc.localDescription!));
          } catch (err) {
            console.error("Offer failed:", err);
            setConnectionError("Could not start video. Tap Next.");
          }
          return;
        }

        if (earlyOffer?.sdp) {
          pendingOfferRef.current = null;
          try {
            await handleOffer(earlyOffer, socket);
          } catch (err) {
            console.error("Early offer failed:", err);
            setConnectionError("Could not answer video. Tap Next.");
          }
        }
      });

      socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
        console.log("[Skipcam] got offer");
        if (!offer?.sdp) return;

        // Offer arrived before we finished matched setup — queue it
        if (!pcRef.current || isInitiatorRef.current) {
          pendingOfferRef.current = offer;
          return;
        }

        try {
          await handleOffer(offer, socket);
        } catch (err) {
          console.error("Offer handle failed:", err);
          setConnectionError("Could not answer video. Tap Next.");
        }
      });

      socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
        console.log("[Skipcam] got answer");
        const pc = pcRef.current;
        if (!pc || !answer?.sdp) return;
        try {
          if (pc.signalingState !== "have-local-offer") return;
          await pc.setRemoteDescription(answer);
          await flushPendingCandidates(pc);
        } catch (err) {
          console.error("Answer failed:", err);
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
          console.error("ICE add failed:", err);
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
      handleOffer,
      loadIceConfig,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    void loadIceConfig();

    (async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: getVideoConstraintsForScreen(),
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
        setMicOn(true);
        setCameraOn(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          void localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("getUserMedia failed:", err);
        setCameraReady(false);
        setConnectionError("Allow camera and microphone to continue.");
      }
    })();

    return () => {
      cancelled = true;
      cleanupPeerConnection();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [cleanupPeerConnection, loadIceConfig]);

  useEffect(() => {
    const video = localVideoRef.current;
    const stream = localStreamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    void video.play().catch(() => {});
  });

  useEffect(() => {
    if (status !== "connected" || !remoteStreamRef.current) return;
    bindRemoteMedia(remoteStreamRef.current);
  }, [status, bindRemoteMedia]);

  const startMatching = useCallback(() => {
    if (!localStreamRef.current) {
      setConnectionError("Camera is not ready yet.");
      return;
    }

    setConnectionError(null);
    setStatus("waiting");
    cleanupPeerConnection();

    if (!socketRef.current) {
      const socket = io(getSignalingUrl(), {
        transports: ["polling", "websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        timeout: 20000,
      });
      socketRef.current = socket;
      bindSocketEvents(socket);

      socket.on("connect", () => {
        setConnectionError(null);
        socket.emit("find-match");
      });

      socket.on("connect_error", (err) => {
        console.error("socket error:", err.message);
        setConnectionError("Cannot reach server. Retrying…");
      });
    } else if (socketRef.current.connected) {
      socketRef.current.emit("find-match");
    } else {
      socketRef.current.connect();
      socketRef.current.once("connect", () => {
        socketRef.current?.emit("find-match");
      });
    }
  }, [bindSocketEvents, cleanupPeerConnection]);

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
    socketRef.current?.emit("reaction", emoji);
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
