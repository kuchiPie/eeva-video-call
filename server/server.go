package main

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v2"
	"io"
	"log"
	"net/http"
	"os"
	"time"
	"github.com/gin-contrib/cors"
)

const (
	rtcpPLIInterval = time.Second * 3
)

type Sdp struct {
	Sdp string
}

func main() {
	file, err := os.OpenFile("info.log", os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	log.SetOutput(file)

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowAllOrigins: true,
		AllowCredentials: true,
		AllowHeaders: []string{"Content-Type", "Authorization"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		ExposeHeaders: []string{"Content-Length"},
	}))

	peerConnectionMap := make(map[string]chan *webrtc.Track)

	m := webrtc.MediaEngine{}

	m.RegisterCodec(webrtc.NewRTPVP8Codec(webrtc.DefaultPayloadTypeVP8, 90000))

	api := webrtc.NewAPI(webrtc.WithMediaEngine(m))

	peerConnectionConfig := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	router.POST("/webrtc/sdp/c/:userId/p/:peerId/s/:isSender", func(c *gin.Context) {
		isSender := c.Param("isSender") == "true"

		userId := c.Param("userId")
		peerId := c.Param("peerId")

		fmt.Println("userId", userId)
		fmt.Println("peerId", peerId)
		fmt.Println("isSender", isSender)

		var session Sdp
		err := c.ShouldBindJSON(&session)

		if err != nil {
			log.Printf("Error binding JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}

		offer := webrtc.SessionDescription{}
		Decode(session.Sdp, &offer)

		peerConnection, err := api.NewPeerConnection(peerConnectionConfig)

		if err != nil {
			log.Fatal("Error creating peer connection: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create peer connection"})
			return
		}

		if !isSender {
			receiveTrack(peerConnection, peerConnectionMap, peerId)
		} else {
			createTrack(peerConnection, peerConnectionMap, userId)
		}

		peerConnection.SetRemoteDescription(offer)

		answer, err := peerConnection.CreateAnswer(nil)

		if err != nil {
			log.Fatal("Error creating answer: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create answer"})
			return
		}

		err = peerConnection.SetLocalDescription(answer)

		if err != nil {
			log.Fatal("Error setting local description: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set local description"})
			return
		}

		c.JSON(http.StatusOK, Sdp{Sdp: Encode(answer)})

	})

	router.Run("0.0.0.0:8080")
}

func receiveTrack(peerConnection *webrtc.PeerConnection, peerConnectionMap map[string]chan *webrtc.Track, peerId string) {
	if _, ok := peerConnectionMap[peerId]; !ok {
		peerConnectionMap[peerId] = make(chan *webrtc.Track, 1)
	}
	localTrack := <-peerConnectionMap[peerId]
	peerConnection.AddTrack(localTrack)
}

func createTrack(peerConnection *webrtc.PeerConnection, peerConnectionMap map[string]chan *webrtc.Track, currentUserId string) {
	if _, err := peerConnection.AddTransceiver(webrtc.RTPCodecTypeVideo); err != nil {
		log.Fatal(err)
	}

	peerConnection.OnTrack(func(remoteTrack *webrtc.Track, receiver *webrtc.RTPReceiver){

		go func() {
			ticker := time.NewTicker(rtcpPLIInterval)
			for range ticker.C {
				if rtcpSendErr := peerConnection.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: remoteTrack.SSRC()}}); rtcpSendErr != nil {
					fmt.Println(rtcpSendErr)
				}
			}
		}()

		localTrack, newTrackErr := peerConnection.NewTrack(remoteTrack.PayloadType(), remoteTrack.SSRC(), "video", "pion")

		if newTrackErr != nil {
			log.Fatal(newTrackErr)
		}

		localTrackChan := make(chan *webrtc.Track, 1)
		localTrackChan <- localTrack

		if existingChan, ok := peerConnectionMap[currentUserId]; ok {
			// feed the existing track from user with this track
			existingChan <- localTrack
		} else {
			peerConnectionMap[currentUserId] = localTrackChan
		}

		rtpBuf := make([]byte, 1400)

		for {
			i, readErr := remoteTrack.Read(rtpBuf)
			if readErr != nil {
				log.Fatal(readErr)
			}

			if _, err := localTrack.Write(rtpBuf[:i]); err != nil && err != io.ErrClosedPipe {
				log.Fatal(err)
			}
		}
	})
}