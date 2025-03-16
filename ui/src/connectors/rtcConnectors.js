const serverUrl = "https://eeva-video-call.onrender.com";

const createSenderConnection = async ({
  userCode,
  localStream,
  friendCode,
}) => {
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "1022eaaea0c246d013453fcd",
        credential: "wG83FWzOvtJ88iMx",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "1022eaaea0c246d013453fcd",
        credential: "wG83FWzOvtJ88iMx",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "1022eaaea0c246d013453fcd",
        credential: "wG83FWzOvtJ88iMx",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "1022eaaea0c246d013453fcd",
        credential: "wG83FWzOvtJ88iMx",
      },
    ],
    iceTransportPolicy: "all", // Try both UDP and TCP
    iceCandidatePoolSize: 10, // Increase candidates
  });

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
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: [
          "turn:global.turn.twilio.com:3478?transport=udp",
          "turn:global.turn.twilio.com:3478?transport=tcp",
          "turn:global.turn.twilio.com:443?transport=tcp",
        ],
        username: "your_twilio_account_sid:your_twilio_username",
        credential: "your_twilio_token",
      },
    ],
    iceTransportPolicy: "all", // Try both UDP and TCP
    iceCandidatePoolSize: 10, // Increase candidates
  });

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
