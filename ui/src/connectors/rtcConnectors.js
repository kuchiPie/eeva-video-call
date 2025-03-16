// Get API URL from environment variable
const serverUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Function to create WebRTC configuration with ICE servers
const getWebRTCConfig = () => {
  return {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: [
          process.env.NEXT_PUBLIC_TURN_SERVER_URL_1 || "turn:a.relay.metered.ca:80",
          process.env.NEXT_PUBLIC_TURN_SERVER_URL_2 || "turn:a.relay.metered.ca:80?transport=tcp",
          process.env.NEXT_PUBLIC_TURN_SERVER_URL_3 || "turn:a.relay.metered.ca:443",
          process.env.NEXT_PUBLIC_TURN_SERVER_URL_4 || "turn:a.relay.metered.ca:443?transport=tcp",
        ],
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || "your_metered_username",
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "your_metered_credential",
      },
    ],
    iceCandidatePoolSize: 10,
  };
};

const createSenderConnection = async ({
  userCode,
  localStream,
  friendCode,
}) => {
  const peerConnection = new RTCPeerConnection(getWebRTCConfig());

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const response = await fetch(
    `${serverUrl}/webrtc/sdp/c/${userCode}/p/${friendCode}/s/true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Sdp: btoa(JSON.stringify(peerConnection.localDescription)),
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create sender connection");
  }

  const { Sdp } = await response.json();
  const answer = JSON.parse(atob(Sdp));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

  return peerConnection;
};

const createReceiverConnection = async ({
  userCode,
  friendCode,
  setFriendStream,
  friendVideoRef,
}) => {
  const peerConnection = new RTCPeerConnection(getWebRTCConfig());

  peerConnection.ontrack = (e) => {
    if (friendVideoRef.current && e.streams[0]) {
      friendVideoRef.current.srcObject = e.streams[0];
    }
    friendVideoRef.current = e.streams[0];

    setFriendStream(e.streams[0]);
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE state: ${peerConnection.iceConnectionState}`);
    // If it stays in "checking" or goes to "failed", you have ICE problems
  };

  peerConnection.onicegatheringstatechange = () => {
    console.log(`ICE gathering state: ${peerConnection.iceGatheringState}`);
  };

  peerConnection.onicecandidate = (event) => {
    console.log("ICE candidate:", event.candidate);
  };

  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await peerConnection.setLocalDescription(offer);

  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE state: ${peerConnection.iceConnectionState}`);
    // If it stays in "checking" or goes to "failed", you have ICE problems
  };

  peerConnection.onicegatheringstatechange = () => {
    console.log(`ICE gathering state: ${peerConnection.iceGatheringState}`);
  };

  peerConnection.onicecandidate = (event) => {
    console.log("ICE candidate:", event.candidate);
  };

  const response = await fetch(
    `${serverUrl}/webrtc/sdp/c/${userCode}/p/${friendCode}/s/false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Sdp: btoa(JSON.stringify(peerConnection.localDescription)),
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create receiver connection");
  }

  const { Sdp } = await response.json();
  const answer = JSON.parse(atob(Sdp));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

  return peerConnection;
};

export { createSenderConnection, createReceiverConnection };
