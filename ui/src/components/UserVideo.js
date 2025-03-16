const UserVideo = ({ localVideoRef }) => {
  return (
    <video
      ref={localVideoRef}
      autoPlay
      playsInline
      muted
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default UserVideo;
