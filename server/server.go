package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v2"
)

const (
	rtcpPLIInterval = time.Second * 3
)

type Sdp struct {
	Sdp string
}

func main() {
	godotenv.Load()

	file, err := os.OpenFile("info.log", os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	log.SetOutput(file)

	router := gin.Default()

	allowedOrigins := []string{"http://localhost:3000"}
	if origins := os.Getenv("ALLOWED_ORIGINS"); origins != "" {
		allowedOrigins = append(allowedOrigins, origins)
	}

	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	peerConnectionMap := make(map[string]chan *webrtc.Track)

	m := webrtc.MediaEngine{}

	m.RegisterCodec(webrtc.NewRTPVP8Codec(webrtc.DefaultPayloadTypeVP8, 90000))

	api := webrtc.NewAPI(webrtc.WithMediaEngine(m))

	turnServerURLs := []string{
		"turn:a.relay.metered.ca:80",
		"turn:a.relay.metered.ca:80?transport=tcp",
		"turn:a.relay.metered.ca:443",
		"turn:a.relay.metered.ca:443?transport=tcp",
	}

	if customURLs := os.Getenv("TURN_SERVER_URLS"); customURLs != "" {
		turnServerURLs = []string{customURLs}
	}

	turnUsername := os.Getenv("TURN_USERNAME")
	turnCredential := os.Getenv("TURN_CREDENTIAL")

	peerConnectionConfig := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
			{
				URLs:       turnServerURLs,
				Username:   turnUsername,
				Credential: turnCredential,
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
			fmt.Println("Error binding JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}

		offer := webrtc.SessionDescription{}
		Decode(session.Sdp, &offer)

		peerConnection, err := api.NewPeerConnection(peerConnectionConfig)

		if err != nil {
			log.Fatal("Error creating peer connection: %v", err)
			fmt.Println("Error creating peer connection: %v", err)
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
			fmt.Println("Error creating answer: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create answer"})
			return
		}

		err = peerConnection.SetLocalDescription(answer)

		if err != nil {
			log.Fatal("Error setting local description: %v", err)
			fmt.Println("Error setting local description: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set local description"})
			return
		}

		c.JSON(http.StatusOK, Sdp{Sdp: Encode(answer)})

	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	router.Run("0.0.0.0:" + port)
}

func receiveTrack(peerConnection *webrtc.PeerConnection, peerConnectionMap map[string]chan *webrtc.Track, peerId string) {
	if _, ok := peerConnectionMap[peerId]; !ok {
		fmt.Println("Creating new channel for peerId", peerId)
		peerConnectionMap[peerId] = make(chan *webrtc.Track, 1)
	}
	fmt.Println("Receiving track for peerId", peerId)
	localTrack := <-peerConnectionMap[peerId]
	peerConnection.AddTrack(localTrack)
}

func createTrack(peerConnection *webrtc.PeerConnection, peerConnectionMap map[string]chan *webrtc.Track, currentUserId string) {
	if _, err := peerConnection.AddTransceiver(webrtc.RTPCodecTypeVideo); err != nil {
		log.Fatal(err)
		fmt.Println("Error adding transceiver: %v", err)
	}

	fmt.Println("Creating track for peerId", currentUserId)
	peerConnection.OnTrack(func(remoteTrack *webrtc.Track, receiver *webrtc.RTPReceiver) {
		fmt.Println("OnTrack for peerId", currentUserId)
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
		fmt.Println("Reading from remote track for peerId", currentUserId)
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
