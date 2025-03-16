const serverUrl = "https://eeva-video-call.onrender.com";

const createSenderConnection = async ({
  userCode,
  localStream,
  friendCode,
}) => {
  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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

const createReceiverConnection = async ({userCode, friendCode, setFriendStream, friendVideoRef}) => {
    const peerConnection = new RTCPeerConnection({
        iceServers: [{urls: "stun:stun.l.google.com:19302"}]
    });
    
    peerConnection.ontrack = (e) => {
        if (friendVideoRef.current && e.streams[0]) {
            friendVideoRef.current.srcObject = e.streams[0];
        }
        friendVideoRef.current = e.streams[0];

        setFriendStream(e.streams[0]);
    }

    const offer = await peerConnection.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true});
    await peerConnection.setLocalDescription(offer);

    const response = await fetch(`${serverUrl}/webrtc/sdp/c/${userCode}/p/${friendCode}/s/false`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            Sdp: btoa(JSON.stringify(peerConnection.localDescription)),
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to create receiver connection");
    }

    const {Sdp} = await response.json();
    const answer = JSON.parse(atob(Sdp));

    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    return peerConnection;
}

export {createSenderConnection, createReceiverConnection};