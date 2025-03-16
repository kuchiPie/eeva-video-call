const FriendVideo = ({ friendVideoRef }) => {
  return (
    <video
      ref={friendVideoRef}
      autoPlay
      playsInline
      muted={false}
      style={{ width: "100%", maxWidth: "100%" }}
    />
  );
};

export default FriendVideo;
