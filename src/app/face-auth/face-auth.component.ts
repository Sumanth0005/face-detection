
import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-face-auth',
  templateUrl: './face-auth.component.html',
  styleUrls: ['./face-auth.component.css'],
})
export class FaceAuthComponent implements OnInit {
  @ViewChild('videoElement', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  result: string = '⏳ Initializing...';
  isLoading: boolean = true;

  async ngOnInit() {
    console.log('⏳ Initializing...');
    try {
      await this.loadModels();
      this.startVideo();
    } catch (err) {
      console.error('❌ Error initializing:', err);
      this.result = '❌ Failed to load models or webcam';
    }
  }

  async loadModels() {
    const MODEL_URL = '/assets/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    console.log('✅ Models loaded');
  }

  startVideo() {
    const video = this.videoRef.nativeElement;

    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        video.srcObject = stream;

        video.onloadeddata = () => {
          video.play();
          this.createCanvasOverlay();
          this.isLoading = false;
          this.result = '✅ Webcam started';
        };
      })
      .catch((err) => {
        console.error('❌ Webcam error:', err);
        this.result = '❌ Webcam access denied';
      });
  }

  createCanvasOverlay() {
    const video = this.videoRef.nativeElement;
    const canvas = faceapi.createCanvasFromMedia(video);
    canvas.id = 'overlay-canvas';
    document.getElementById('video-container')?.appendChild(canvas);

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      const resized = faceapi.resizeResults(detections, displaySize);
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resized);
      faceapi.draw.drawFaceLandmarks(canvas, resized);
    }, 300);
  }
  async verify() {
    this.result = '🔍 Verifying...';
  
    const video = this.videoRef.nativeElement;
    const liveDescriptor = await this.getDescriptor(video);
  
    if (!liveDescriptor) {
      this.result = '❌ No face detected in webcam';
      return;
    }
  
    const referenceImages = Array.from(document.getElementsByClassName('reference')) as HTMLImageElement[];
  
    const matches: { label: string; distance: number }[] = [];
  
    for (const img of referenceImages) {
      if (!img.complete || img.naturalHeight === 0){
        console.warn(`⚠️ Image ${img.alt} not fully loaded`);
        continue;
      } ;
      const refDescriptor = await this.getDescriptor(img);
  
      if (!refDescriptor) {
        console.warn(`⚠️ No face detected in image: ${img.alt}`);
      } else {
        console.log(`✅ Face detected in ${img.alt}`);
      }
    
      const distance = refDescriptor
        ? faceapi.euclideanDistance(refDescriptor, liveDescriptor)
        : null;
    
      if (distance !== null) {
        console.log(`🔬 ${img.alt}: distance = ${distance}`);
        matches.push({ label: img.alt, distance });
      }
    }
  
    if (matches.length === 0) {
      this.result = '❌ No valid reference faces found';
      return;
    }
  
    // Find best match
    const bestMatch = matches.reduce((prev, curr) =>
      curr.distance < prev.distance ? curr : prev
    );
  
    console.log('🔍 Best match:', bestMatch);
  
    this.result =
      bestMatch.distance < 0.6
        ? `✅ Face Matched: ${bestMatch.label}`
        : '❌ Face Not Matched: Access Denied';
  }
  

  async getDescriptor(input: HTMLImageElement | HTMLVideoElement): Promise<Float32Array | null> {
    const detection = await faceapi
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection?.descriptor || null;
  }
}
