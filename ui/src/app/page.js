"use client";
import Heading from "@radui/ui/Heading";
import { useState, useEffect, useRef } from "react";
import Button from "@radui/ui/Button";
import FriendVideo from "../components/FriendVideo";
import UserVideo from "../components/UserVideo";
import {
  createSenderConnection,
  createReceiverConnection,
} from "../connectors/rtcConnectors";

const FriendCodeArea = ({
  connected,
  disconnectHandler,
  connectHandler,
  loading,
}) => {
  const [friendCode, setfriendCode] = useState(null);
  if (loading) {
    return (
      <div>
        Please wait while we connect... Since I am hosting on render, it might
        take around a minute to connect. I appreciate your patience.
      </div>
    );
  }
  if (connected) {
    return (
      <div className="flex gap-2">
        <div>Your friend&apos;s code: {friendCode}</div>
        <Button onClick={disconnectHandler}>Disconnect</Button>
      </div>
    );
  }
  return (
    <div>
      Enter your friend&apos;s code:
      <input type="text" onChange={(e) => setfriendCode(e.target.value)} />
      <Button onClick={() => connectHandler({ friendCode })}>Connect</Button>
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getRandomCode = () => {
      return Math.random().toString(36).substring(2, 15);
    };
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
  }, []);

  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localStream]);

  // Separate effect for friend stream cleanup
  useEffect(() => {
    return () => {
      if (friendStream) {
        friendStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [friendStream]);

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
    setLoading(true);
    try {
      const senderPC = await createSenderConnection({
        userCode,
        localStream,
        friendCode,
      });
      const receiverPC = await createReceiverConnection({
        userCode,
        friendCode,
        setFriendStream,
        friendVideoRef,
      });
      setConnected(true);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
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
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
