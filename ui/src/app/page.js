"use client";
import Heading from "@radui/ui/Heading";
import { useState, useEffect, useRef } from "react";
import Button from "@radui/ui/Button";
import FriendVideo from "../components/FriendVideo";
import UserVideo from "../components/UserVideo";
import { createSenderConnection, createReceiverConnection } from "../connectors/rtcConnectors";

const FriendCodeArea = ({ connected, disconnectHandler, connectHandler }) => {
  const [friendCode, setfriendCode] = useState(null);
  if (connected) {
    return (
      <div className="flex gap-2">
        <div>Your friend's code: {friendCode}</div>
        <Button onClick={disconnectHandler}>Disconnect</Button>
      </div>
    );
  }
  return (
    <div>
      Enter your friend's code:
      <input type="text" onChange={(e) => setfriendCode(e.target.value)} />
      <Button onClick={() => connectHandler({friendCode})}>Connect</Button>
    </div>
  );
};

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [userCode, setUserCode] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [friendStream, setFriendStream] = useState(null);
  const localVideoRef = useRef(null);
  const friendVideoRef = useRef(null);

  const getRandomCode = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  useEffect(() => {
    setUserCode(getRandomCode());

    const getUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setLocalStream(stream);
      } catch (error) {
        console.error(error);
      }
    };
    getUserMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      // todo: close friend stream
      if (friendStream) {
        friendStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const disconnectHandler = () => {
    setUserCode(null);
    setConnected(false);
    if (friendStream) {
      friendStream.getTracks().forEach((track) => track.stop());
    }
    setFriendStream(null);
    friendVideoRef.current = null;
  };

  const connectHandler = async ({ friendCode }) => {
    console.log({localStream, friendCode})
    try {
      const senderPC = await createSenderConnection({userCode, localStream, friendCode});
      const receiverPC = await createReceiverConnection({userCode, friendCode, setFriendStream, friendVideoRef});
      setConnected(true);
    } catch (error) {
      console.error(error);
    }

  };

  return (
    <div>
      <Heading className="text-center text-4xl p-10">
        Eeva: Video Call your friend
      </Heading>
      <div className="flex items-center justify-center gap-10">
        <div className="w-1/2 min-h-180 p-2">
          <div className="border-2 border-white-500 w-full min-h-180">
            <UserVideo localVideoRef={localVideoRef} />
          </div>
          Your Code: {userCode}
          <Button onClick={() => navigator.clipboard.writeText(userCode)}>
            Copy my code
          </Button>
        </div>
        <div className="w-1/2 min-h-180 p-2">
          <div className="border-2 border-white-500 w-full min-h-180">
            <FriendVideo friendVideoRef={friendVideoRef} />
          </div>
          <FriendCodeArea
            connected={connected}
            disconnectHandler={disconnectHandler}
            connectHandler={connectHandler}
          />
        </div>
      </div>
    </div>
  );
}
