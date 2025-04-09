
import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import * as faceapi from 'face-api.js';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'app-face-auth',
  templateUrl: './face-auth.component.html',
  styleUrls: ['./face-auth.component.css'],
})
export class FaceAuthComponent implements OnInit {
  @ViewChild('videoElement', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  result: string = '⏳ Initializing...';
  isLoading: boolean = true;
  referenceImages: HTMLImageElement[] = [];

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    try {
      await this.loadModels();
      await this.startVideo();
      await this.loadReferenceImages(); // 🧠 New
    } catch (err) {
      console.error('❌ Error:', err);
      this.result = '❌ Initialization failed';
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

  async startVideo() {
    const video = this.videoRef.nativeElement;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    video.onloadeddata = () => {
      video.play();
      this.createCanvasOverlay();
      this.isLoading = false;
      this.result = '✅ Webcam started';
    };
  }

  async loadReferenceImages() {
    this.result = '📦 Loading reference images...';
    const metadata: any = await this.http.get('http://localhost:3000/images').toPromise();

    for (const meta of metadata) {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Required for face-api
      img.src = `http://localhost:3000/image/${meta._id}`;
      img.alt = meta.name;

      await new Promise((resolve) => {
        img.onload = () => resolve(true);
      });

      this.referenceImages.push(img);
    }

    console.log('✅ Loaded reference images:', this.referenceImages.length);
  }

  async verify() {
    this.result = '🔍 Verifying...';
    const video = this.videoRef.nativeElement;
    const liveDescriptor = await this.getDescriptor(video);

    if (!liveDescriptor) {
      this.result = '❌ No face detected in webcam';
      return;
    }

    const matches: { label: string; distance: number }[] = [];

    for (const img of this.referenceImages) {
      const refDescriptor = await this.getDescriptor(img);

      if (!refDescriptor) {
        console.warn(`⚠️ No face in ${img.alt}`);
        continue;
      }

      const distance = faceapi.euclideanDistance(refDescriptor, liveDescriptor);
      matches.push({ label: img.alt, distance });
    }

    if (matches.length === 0) {
      this.result = '❌ No valid faces found';
      return;
    }

    const bestMatch = matches.reduce((prev, curr) => (curr.distance < prev.distance ? curr : prev));
    this.result = bestMatch.distance < 0.6
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
}
